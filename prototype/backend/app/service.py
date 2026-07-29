from __future__ import annotations

import hashlib
import hmac
import secrets
from collections.abc import Callable
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from functools import partial, wraps
from threading import RLock
from typing import Concatenate, ParamSpec, TypeVar
from uuid import uuid4

from .domain import (
    AuditEvent,
    AuthorizationNotFoundError,
    AuthorizationOutcome,
    AuthorizationRecord,
    AuthorizationRepository,
    AuthorizationStatus,
    DeviceCommand,
    DeviceCommandType,
    DispenserError,
    DispenserGateway,
    Fuel,
    IdempotencyConflictError,
    InvalidAuthorizationStateError,
    InvalidPlateError,
    MappingStatus,
    MAX_DEVICE_TTL_SECONDS,
    ProviderTimeoutError,
    ProviderUnavailableError,
    ReasonCode,
    UnknownPumpError,
    VehicleDataProvider,
    VehicleNotFoundError,
)
from .fuel_mapping import map_vehicle_fuels
from .providers import normalize_plate


def utc_now() -> datetime:
    return datetime.now(UTC)


OVERRIDEABLE_REASONS = frozenset(
    {
        ReasonCode.VEHICLE_NOT_FOUND,
        ReasonCode.PROVIDER_TIMEOUT,
        ReasonCode.PROVIDER_UNAVAILABLE,
        ReasonCode.FUEL_MAPPING_UNKNOWN,
        ReasonCode.FUEL_MAPPING_AMBIGUOUS,
    }
)

P = ParamSpec("P")
R = TypeVar("R")


def serialized_operation(
    method: Callable[Concatenate["AuthorizationService", P], R],
) -> Callable[Concatenate["AuthorizationService", P], R]:
    """Serializa transições que podem alterar a mesma bomba/autorização."""

    @wraps(method)
    def wrapper(
        service: "AuthorizationService", *args: P.args, **kwargs: P.kwargs
    ) -> R:
        with service._operation_lock:
            return method(service, *args, **kwargs)

    return wrapper


class AuthorizationService:
    def __init__(
        self,
        provider: VehicleDataProvider,
        gateway: DispenserGateway,
        repository: AuthorizationRepository,
        ttl_seconds: int = 30,
        clock: Callable[[], datetime] = utc_now,
        idempotency_secret: bytes | None = None,
    ) -> None:
        if not 1 <= ttl_seconds <= MAX_DEVICE_TTL_SECONDS:
            raise ValueError(
                f"ttl_seconds deve estar entre 1 e {MAX_DEVICE_TTL_SECONDS}"
            )
        self._provider = provider
        self._gateway = gateway
        self._repository = repository
        self._ttl_seconds = ttl_seconds
        self._clock = clock
        self._idempotency_secret = idempotency_secret or secrets.token_bytes(32)
        self._compatibility_cache: dict[
            str,
            tuple[
                datetime,
                tuple[AuthorizationStatus, tuple[Fuel, ...], ReasonCode],
            ],
        ] = {}
        # O protótipo usa um único processo e SQLite. A trava reentrante mantém
        # check-and-act atômico nesse processo; o índice parcial no banco oferece
        # uma segunda barreira para impedir duas autorizações ativas por bomba.
        self._operation_lock = RLock()

    @property
    def provider_mode(self) -> str:
        return self._provider.mode

    @serialized_operation
    def fail_closed_invalid_request(
        self, pump_id: str, actor_id: str = "validation-guard"
    ) -> None:
        """Bloqueia a bomba identificável mesmo quando o payload é inválido.

        A validação HTTP pode falhar antes de construir AuthorizationRequest.
        Quando ainda há um pump_id sintaticamente seguro, este guardião encerra
        qualquer autorização anterior. Payloads sem bomba não permitem inferir
        com segurança qual dispositivo deve ser alterado.
        """

        now = self._clock()
        self._lock_before_decision(pump_id, now)
        active = self._repository.active_for_pump(pump_id)
        if active is not None:
            self._supersede(active, actor_id=actor_id)

    @serialized_operation
    def reconcile_startup(self) -> None:
        """Invalida intents/autorizacoes antigas ao iniciar o backend.

        O simulador e o firmware partem fisicamente bloqueados. O banco nunca
        deve continuar anunciando uma autorização ativa de outro processo.
        """

        for record in self._repository.active_records():
            self._best_effort_lock(record.pump_id)
            now = self._clock()
            expired = replace(
                record,
                status=AuthorizationStatus.EXPIRED,
                reason_code=ReasonCode.AUTHORIZATION_EXPIRED,
                updated_at=now,
                expires_at=None,
            )
            self._repository.update(
                expired,
                self._event(expired, "STARTUP_RECONCILIATION", actor_id="system"),
            )

    @serialized_operation
    def check_compatibility(
        self, plate: str
    ) -> tuple[AuthorizationStatus, tuple[Fuel, ...], ReasonCode]:
        normalized = normalize_plate(plate)
        cache_key = hmac.new(
            self._idempotency_secret, normalized.encode("ascii"), hashlib.sha256
        ).hexdigest()
        now = self._clock()
        cached = self._compatibility_cache.get(cache_key)
        if cached is not None and cached[0] > now:
            return cached[1]

        result = self._check_compatibility_uncached(normalized)
        self._compatibility_cache[cache_key] = (
            now + timedelta(seconds=self._ttl_seconds),
            result,
        )
        return result

    def _check_compatibility_uncached(
        self, plate: str
    ) -> tuple[AuthorizationStatus, tuple[Fuel, ...], ReasonCode]:
        try:
            vehicle = self._provider.get_vehicle(plate)
        except InvalidPlateError:
            raise
        except VehicleNotFoundError:
            return AuthorizationStatus.REVIEW_REQUIRED, (), ReasonCode.VEHICLE_NOT_FOUND
        except ProviderTimeoutError:
            return AuthorizationStatus.REVIEW_REQUIRED, (), ReasonCode.PROVIDER_TIMEOUT
        except ProviderUnavailableError:
            return (
                AuthorizationStatus.REVIEW_REQUIRED,
                (),
                ReasonCode.PROVIDER_UNAVAILABLE,
            )

        mapping = map_vehicle_fuels(vehicle.fuel_description)
        if mapping.status is MappingStatus.NO_COMBUSTIBLE_FUEL:
            return (
                AuthorizationStatus.DENIED,
                (),
                ReasonCode.NO_COMBUSTIBLE_FUEL,
            )
        if mapping.status is MappingStatus.UNKNOWN:
            return (
                AuthorizationStatus.REVIEW_REQUIRED,
                (),
                ReasonCode.FUEL_MAPPING_UNKNOWN,
            )
        if mapping.status is MappingStatus.AMBIGUOUS:
            return (
                AuthorizationStatus.REVIEW_REQUIRED,
                (),
                ReasonCode.FUEL_MAPPING_AMBIGUOUS,
            )
        return (
            AuthorizationStatus.AUTHORIZED,
            mapping.compatible_fuels,
            ReasonCode.FUEL_COMPATIBLE,
        )

    @serialized_operation
    def authorize(
        self,
        *,
        plate: str,
        requested_fuel: Fuel,
        attendant_id: str,
        pump_id: str,
        client_request_id: str | None = None,
    ) -> AuthorizationOutcome:
        authorization_id = str(uuid4())
        request_id = client_request_id or str(uuid4())
        now = self._clock()

        fingerprint = self._request_fingerprint(
            plate=plate,
            requested_fuel=requested_fuel,
            attendant_id=attendant_id,
            pump_id=pump_id,
        )

        try:
            normalize_plate(plate)
            plate_is_valid = True
        except InvalidPlateError:
            plate_is_valid = False
            # A placa invalida e um evento de seguranca, inclusive quando o
            # client_request_id conflita com uma autorizacao anterior. O
            # bloqueio precisa ocorrer antes de devolver o eventual HTTP 409.
            self._lock_before_decision(pump_id, now)
            active = self._repository.active_for_pump(pump_id)
            if active is not None:
                self._supersede(active, actor_id=attendant_id)

        existing = self._repository.get_by_client_request_id(request_id)
        if existing is not None:
            if not hmac.compare_digest(existing.request_fingerprint or "", fingerprint):
                raise IdempotencyConflictError(
                    "client_request_id já foi usado com outro payload"
                )
            current = self.get(existing.authorization_id)
            compatible_fuels: tuple[Fuel, ...] = ()
            if current.status in {
                AuthorizationStatus.PENDING_DEVICE,
                AuthorizationStatus.AUTHORIZED,
                AuthorizationStatus.REVIEW_REQUIRED,
                AuthorizationStatus.DENIED,
            } and plate_is_valid:
                _, compatible_fuels, _ = self.check_compatibility(plate)
            return AuthorizationOutcome(current, compatible_fuels)

        create_outcome = partial(
            self._create_outcome,
            client_request_id=request_id,
            request_fingerprint=fingerprint,
        )

        if not plate_is_valid:
            return create_outcome(
                authorization_id=authorization_id,
                status=AuthorizationStatus.REVIEW_REQUIRED,
                requested_fuel=requested_fuel,
                attendant_id=attendant_id,
                pump_id=pump_id,
                reason_code=ReasonCode.INVALID_PLATE,
                now=now,
            )

        active = self._repository.active_for_pump(pump_id)
        if active is not None:
            if active.expires_at is not None and active.expires_at <= now:
                self._expire(active)
            else:
                return create_outcome(
                    authorization_id=authorization_id,
                    status=AuthorizationStatus.REVIEW_REQUIRED,
                    requested_fuel=requested_fuel,
                    attendant_id=attendant_id,
                    pump_id=pump_id,
                    reason_code=ReasonCode.PUMP_BUSY,
                    now=now,
                )

        device_reason = self._lock_before_decision(pump_id, now)
        if device_reason is not None:
            return create_outcome(
                authorization_id=authorization_id,
                status=AuthorizationStatus.REVIEW_REQUIRED,
                requested_fuel=requested_fuel,
                attendant_id=attendant_id,
                pump_id=pump_id,
                reason_code=device_reason,
                now=now,
            )

        status, compatible_fuels, reason_code = self.check_compatibility(plate)
        if status is not AuthorizationStatus.AUTHORIZED:
            return create_outcome(
                authorization_id=authorization_id,
                status=status,
                requested_fuel=requested_fuel,
                attendant_id=attendant_id,
                pump_id=pump_id,
                reason_code=reason_code,
                now=now,
                compatible_fuels=compatible_fuels,
            )

        if requested_fuel not in compatible_fuels:
            return create_outcome(
                authorization_id=authorization_id,
                status=AuthorizationStatus.DENIED,
                requested_fuel=requested_fuel,
                attendant_id=attendant_id,
                pump_id=pump_id,
                reason_code=ReasonCode.FUEL_INCOMPATIBLE,
                now=now,
                compatible_fuels=compatible_fuels,
            )

        try:
            nozzle_id = self._gateway.nozzle_for(pump_id, requested_fuel)
            if nozzle_id is None:
                return create_outcome(
                    authorization_id=authorization_id,
                    status=AuthorizationStatus.REVIEW_REQUIRED,
                    requested_fuel=requested_fuel,
                    attendant_id=attendant_id,
                    pump_id=pump_id,
                    reason_code=ReasonCode.NOZZLE_NOT_CONFIGURED,
                    now=now,
                    compatible_fuels=compatible_fuels,
                )
            expires_at = now + timedelta(seconds=self._ttl_seconds)
            command = DeviceCommand(
                command_id=str(uuid4()),
                type=DeviceCommandType.UNLOCK,
                pump_id=pump_id,
                sequence=self._gateway.next_sequence_for(pump_id),
                nozzle_id=nozzle_id,
                issued_at=now,
                expires_at=expires_at,
                session_id=self._gateway.session_id_for(pump_id),
            )
        except UnknownPumpError:
            return create_outcome(
                authorization_id=authorization_id,
                status=AuthorizationStatus.REVIEW_REQUIRED,
                requested_fuel=requested_fuel,
                attendant_id=attendant_id,
                pump_id=pump_id,
                reason_code=ReasonCode.PUMP_NOT_CONFIGURED,
                now=now,
                compatible_fuels=compatible_fuels,
            )
        except DispenserError:
            self._best_effort_lock(pump_id)
            return create_outcome(
                authorization_id=authorization_id,
                status=AuthorizationStatus.REVIEW_REQUIRED,
                requested_fuel=requested_fuel,
                attendant_id=attendant_id,
                pump_id=pump_id,
                reason_code=ReasonCode.DISPENSER_UNAVAILABLE,
                now=now,
                compatible_fuels=compatible_fuels,
            )

        # A intenção e o command_id são persistidos antes de qualquer UNLOCK.
        # O gateway simulado só retorna após aplicar/confirmar o comando, o que
        # representa o ACK exigido pelo contrato do futuro adaptador MQTT.
        intent = create_outcome(
            authorization_id=authorization_id,
            status=AuthorizationStatus.PENDING_DEVICE,
            requested_fuel=requested_fuel,
            attendant_id=attendant_id,
            pump_id=pump_id,
            reason_code=ReasonCode.DEVICE_COMMAND_PENDING,
            now=now,
            expires_at=expires_at,
            compatible_fuels=compatible_fuels,
            device_command_id=command.command_id,
            event_type="DEVICE_COMMAND_INTENT",
        )

        try:
            self._gateway.apply(command)
        except DispenserError:
            failed_at = self._clock()
            failed = replace(
                intent.record,
                status=AuthorizationStatus.REVIEW_REQUIRED,
                reason_code=ReasonCode.DISPENSER_UNAVAILABLE,
                updated_at=failed_at,
                expires_at=failed_at + timedelta(seconds=self._ttl_seconds),
            )
            self._best_effort_lock(pump_id)
            self._repository.update(
                failed,
                self._event(failed, "DEVICE_COMMAND_FAILED", actor_id=attendant_id),
            )
            return AuthorizationOutcome(failed, compatible_fuels)
        except Exception:
            failed_at = self._clock()
            failed = replace(
                intent.record,
                status=AuthorizationStatus.REVIEW_REQUIRED,
                reason_code=ReasonCode.DISPENSER_UNAVAILABLE,
                updated_at=failed_at,
                expires_at=failed_at + timedelta(seconds=self._ttl_seconds),
            )
            self._best_effort_lock(pump_id)
            try:
                self._repository.update(
                    failed,
                    self._event(
                        failed, "DEVICE_COMMAND_EXCEPTION", actor_id=attendant_id
                    ),
                )
            except Exception:
                # O intent persistido e seu TTL ainda permitem reconciliação.
                pass
            raise

        authorized = replace(
            intent.record,
            status=AuthorizationStatus.AUTHORIZED,
            reason_code=ReasonCode.FUEL_COMPATIBLE,
            updated_at=self._clock(),
        )
        try:
            self._repository.update(
                authorized,
                self._event(authorized, "DEVICE_COMMAND_ACK", actor_id=attendant_id),
            )
        except Exception:
            # A intenção já está auditada. Se a confirmação não puder ser
            # persistida, o bloqueio compensatório é tentado e o TTL local
            # limita a exposição mesmo quando o LOCK_ALL não recebe ACK.
            self._best_effort_lock(pump_id)
            raise
        return AuthorizationOutcome(authorized, compatible_fuels)

    @serialized_operation
    def get(self, authorization_id: str) -> AuthorizationRecord:
        record = self._get_required(authorization_id)
        if (
            record.status in {
                AuthorizationStatus.PENDING_DEVICE,
                AuthorizationStatus.AUTHORIZED,
                AuthorizationStatus.REVIEW_REQUIRED,
            }
            and record.expires_at is not None
            and record.expires_at <= self._clock()
        ):
            record = self._expire(record)
        return record

    @serialized_operation
    def complete(self, authorization_id: str, actor_id: str) -> AuthorizationRecord:
        record = self.get(authorization_id)
        if record.status is not AuthorizationStatus.AUTHORIZED:
            raise InvalidAuthorizationStateError(
                "somente uma autorização ativa pode ser concluída"
            )
        now = self._clock()
        active = self._repository.active_for_pump(record.pump_id)
        if active is not None and active.authorization_id != record.authorization_id:
            raise InvalidAuthorizationStateError(
                "a bomba possui outra autorização ativa; inicie um novo fluxo"
            )
        try:
            self._gateway.apply(self._lock_command(record.pump_id, now))
        except DispenserError as exc:
            raise InvalidAuthorizationStateError(
                "não foi possível confirmar o bloqueio do dispositivo"
            ) from exc

        updated = replace(
            record,
            status=AuthorizationStatus.COMPLETED,
            reason_code=ReasonCode.AUTHORIZATION_COMPLETED,
            updated_at=now,
            expires_at=None,
        )
        self._repository.update(
            updated,
            self._event(updated, "AUTHORIZATION_COMPLETED", actor_id=actor_id),
        )
        return updated

    @serialized_operation
    def override(
        self,
        authorization_id: str,
        supervisor_id: str,
        justification: str,
    ) -> AuthorizationRecord:
        record = self.get(authorization_id)
        # O estado, sozinho, nao basta para autorizar a excecao: falhas de
        # bomba/bico tambem usam REVIEW_REQUIRED para manter o contrato da API,
        # mas nunca podem ser contornadas por override. Somente incertezas da
        # consulta veicular pertencem a este fluxo excepcional. Incompatibilidade
        # confirmada, expiracao e falha de dispositivo exigem um novo processo.
        if (
            record.status is not AuthorizationStatus.REVIEW_REQUIRED
            or record.reason_code not in OVERRIDEABLE_REASONS
        ):
            raise InvalidAuthorizationStateError(
                "estado atual não permite liberação excepcional"
            )

        now = self._clock()
        active = self._repository.active_for_pump(record.pump_id)
        if active is not None and active.authorization_id != record.authorization_id:
            raise InvalidAuthorizationStateError(
                "a bomba possui outra autorização ativa; inicie um novo fluxo"
            )
        try:
            self._gateway.apply(self._lock_command(record.pump_id, now))
            nozzle_id = self._gateway.nozzle_for(record.pump_id, record.requested_fuel)
            if nozzle_id is None:
                raise UnknownPumpError(record.pump_id)
            expires_at = now + timedelta(seconds=self._ttl_seconds)
            command = DeviceCommand(
                command_id=str(uuid4()),
                type=DeviceCommandType.UNLOCK,
                pump_id=record.pump_id,
                sequence=self._gateway.next_sequence_for(record.pump_id),
                nozzle_id=nozzle_id,
                issued_at=now,
                expires_at=expires_at,
                session_id=self._gateway.session_id_for(record.pump_id),
            )
        except DispenserError:
            self._best_effort_lock(record.pump_id)
            failed = replace(
                record,
                status=AuthorizationStatus.REVIEW_REQUIRED,
                reason_code=ReasonCode.OVERRIDE_FAILED,
                updated_at=now,
                expires_at=now + timedelta(seconds=self._ttl_seconds),
                supervisor_id=supervisor_id,
                override_justification=justification,
            )
            self._repository.update(
                failed,
                self._event(
                    failed,
                    "OVERRIDE_FAILED",
                    actor_id=supervisor_id,
                    justification=justification,
                ),
            )
            return failed
        except Exception:
            failed_at = self._clock()
            failed = replace(
                record,
                status=AuthorizationStatus.REVIEW_REQUIRED,
                reason_code=ReasonCode.OVERRIDE_FAILED,
                updated_at=failed_at,
                expires_at=failed_at + timedelta(seconds=self._ttl_seconds),
                supervisor_id=supervisor_id,
                override_justification=justification,
            )
            self._best_effort_lock(record.pump_id)
            try:
                self._repository.update(
                    failed,
                    self._event(
                        failed,
                        "OVERRIDE_EXCEPTION",
                        actor_id=supervisor_id,
                        justification=justification,
                    ),
                )
            except Exception:
                pass
            raise

        intent = replace(
            record,
            status=AuthorizationStatus.PENDING_DEVICE,
            reason_code=ReasonCode.DEVICE_COMMAND_PENDING,
            updated_at=now,
            expires_at=expires_at,
            device_command_id=command.command_id,
            override_used=True,
            supervisor_id=supervisor_id,
            override_justification=justification,
        )
        self._repository.update(
            intent,
            self._event(
                intent,
                "OVERRIDE_DEVICE_INTENT",
                actor_id=supervisor_id,
                justification=justification,
            ),
        )

        try:
            self._gateway.apply(command)
        except DispenserError:
            failed_at = self._clock()
            failed = replace(
                intent,
                status=AuthorizationStatus.REVIEW_REQUIRED,
                reason_code=ReasonCode.OVERRIDE_FAILED,
                updated_at=failed_at,
                expires_at=failed_at + timedelta(seconds=self._ttl_seconds),
            )
            self._best_effort_lock(record.pump_id)
            self._repository.update(
                failed,
                self._event(
                    failed,
                    "OVERRIDE_FAILED",
                    actor_id=supervisor_id,
                    justification=justification,
                ),
            )
            return failed
        except Exception:
            failed_at = self._clock()
            failed = replace(
                intent,
                status=AuthorizationStatus.REVIEW_REQUIRED,
                reason_code=ReasonCode.OVERRIDE_FAILED,
                updated_at=failed_at,
                expires_at=failed_at + timedelta(seconds=self._ttl_seconds),
            )
            self._best_effort_lock(record.pump_id)
            try:
                self._repository.update(
                    failed,
                    self._event(
                        failed,
                        "OVERRIDE_EXCEPTION",
                        actor_id=supervisor_id,
                        justification=justification,
                    ),
                )
            except Exception:
                pass
            raise

        updated = replace(
            intent,
            status=AuthorizationStatus.AUTHORIZED,
            reason_code=ReasonCode.OVERRIDE_AUTHORIZED,
            updated_at=self._clock(),
        )
        try:
            self._repository.update(
                updated,
                self._event(
                    updated,
                    "OVERRIDE_DEVICE_ACK",
                    actor_id=supervisor_id,
                    justification=justification,
                ),
            )
        except Exception:
            # Override sem trilha de auditoria também deve falhar fechado.
            self._best_effort_lock(record.pump_id)
            raise
        return updated

    def audit_events(self, authorization_id: str) -> list[AuditEvent]:
        self._get_required(authorization_id)
        return self._repository.events_for(authorization_id)

    def _lock_before_decision(
        self, pump_id: str, now: datetime
    ) -> ReasonCode | None:
        try:
            self._gateway.apply(self._lock_command(pump_id, now))
            return None
        except UnknownPumpError:
            return ReasonCode.PUMP_NOT_CONFIGURED
        except DispenserError:
            return ReasonCode.DISPENSER_UNAVAILABLE

    def _best_effort_lock(self, pump_id: str) -> None:
        try:
            self._gateway.apply(self._lock_command(pump_id, self._clock()))
        except DispenserError:
            # O TTL local do dispositivo ainda limita a liberação quando não há
            # confirmação do LOCK_ALL.
            pass

    def _lock_command(self, pump_id: str, now: datetime) -> DeviceCommand:
        return DeviceCommand(
            command_id=str(uuid4()),
            type=DeviceCommandType.LOCK_ALL,
            pump_id=pump_id,
            issued_at=now,
            sequence=self._gateway.next_sequence_for(pump_id),
        )

    def _create_outcome(
        self,
        *,
        authorization_id: str,
        status: AuthorizationStatus,
        requested_fuel: Fuel,
        attendant_id: str,
        pump_id: str,
        reason_code: ReasonCode,
        now: datetime,
        expires_at: datetime | None = None,
        compatible_fuels: tuple[Fuel, ...] = (),
        device_command_id: str | None = None,
        event_type: str = "AUTHORIZATION_DECIDED",
        client_request_id: str | None = None,
        request_fingerprint: str | None = None,
    ) -> AuthorizationOutcome:
        if status is AuthorizationStatus.REVIEW_REQUIRED and expires_at is None:
            expires_at = now + timedelta(seconds=self._ttl_seconds)

        record = AuthorizationRecord(
            authorization_id=authorization_id,
            status=status,
            requested_fuel=requested_fuel,
            attendant_id=attendant_id,
            pump_id=pump_id,
            reason_code=reason_code,
            provider_mode=self._provider.mode,
            created_at=now,
            updated_at=now,
            expires_at=expires_at,
            device_command_id=device_command_id,
            client_request_id=client_request_id,
            request_fingerprint=request_fingerprint,
        )
        self._repository.add(
            record,
            self._event(record, event_type, actor_id=attendant_id),
        )
        return AuthorizationOutcome(record, compatible_fuels)

    def _request_fingerprint(
        self,
        *,
        plate: str,
        requested_fuel: Fuel,
        attendant_id: str,
        pump_id: str,
    ) -> str:
        canonical = "\x1f".join(
            (
                "".join(character for character in plate.upper() if character.isalnum()),
                requested_fuel.value,
                attendant_id,
                pump_id,
            )
        ).encode("utf-8")
        return hmac.new(
            self._idempotency_secret, canonical, hashlib.sha256
        ).hexdigest()

    def _supersede(self, record: AuthorizationRecord, actor_id: str) -> None:
        now = self._clock()
        superseded = replace(
            record,
            status=AuthorizationStatus.SUPERSEDED,
            reason_code=ReasonCode.AUTHORIZATION_SUPERSEDED,
            updated_at=now,
            expires_at=None,
        )
        self._repository.update(
            superseded,
            self._event(superseded, "AUTHORIZATION_SUPERSEDED", actor_id=actor_id),
        )

    def _expire(self, record: AuthorizationRecord) -> AuthorizationRecord:
        now = self._clock()
        try:
            self._gateway.apply(self._lock_command(record.pump_id, now))
        except DispenserError:
            # O dispositivo também aplica seu próprio TTL. A falha de ACK não
            # transforma uma autorização vencida em autorização válida.
            pass
        expired = replace(
            record,
            status=AuthorizationStatus.EXPIRED,
            reason_code=ReasonCode.AUTHORIZATION_EXPIRED,
            updated_at=now,
            expires_at=None,
        )
        self._repository.update(expired, self._event(expired, "AUTHORIZATION_EXPIRED"))
        return expired

    def _get_required(self, authorization_id: str) -> AuthorizationRecord:
        record = self._repository.get(authorization_id)
        if record is None:
            raise AuthorizationNotFoundError(authorization_id)
        return record

    def _event(
        self,
        record: AuthorizationRecord,
        event_type: str,
        *,
        actor_id: str | None = None,
        justification: str | None = None,
    ) -> AuditEvent:
        return AuditEvent(
            event_id=str(uuid4()),
            authorization_id=record.authorization_id,
            event_type=event_type,
            status=record.status,
            reason_code=record.reason_code,
            created_at=self._clock(),
            actor_id=actor_id,
            justification=justification,
        )

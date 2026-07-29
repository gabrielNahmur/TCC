from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Protocol

MAX_DEVICE_TTL_SECONDS = 120


class Fuel(StrEnum):
    GASOLINE = "GASOLINE"
    ETHANOL = "ETHANOL"
    DIESEL_S10 = "DIESEL_S10"
    DIESEL_S500 = "DIESEL_S500"
    GNV = "GNV"


class AuthorizationStatus(StrEnum):
    PENDING_DEVICE = "PENDING_DEVICE"
    AUTHORIZED = "AUTHORIZED"
    DENIED = "DENIED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    COMPLETED = "COMPLETED"
    EXPIRED = "EXPIRED"
    SUPERSEDED = "SUPERSEDED"


class ReasonCode(StrEnum):
    DEVICE_COMMAND_PENDING = "DEVICE_COMMAND_PENDING"
    FUEL_COMPATIBLE = "FUEL_COMPATIBLE"
    FUEL_INCOMPATIBLE = "FUEL_INCOMPATIBLE"
    NO_COMBUSTIBLE_FUEL = "NO_COMBUSTIBLE_FUEL"
    VEHICLE_NOT_FOUND = "VEHICLE_NOT_FOUND"
    PROVIDER_TIMEOUT = "PROVIDER_TIMEOUT"
    PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"
    FUEL_MAPPING_UNKNOWN = "FUEL_MAPPING_UNKNOWN"
    FUEL_MAPPING_AMBIGUOUS = "FUEL_MAPPING_AMBIGUOUS"
    INVALID_PLATE = "INVALID_PLATE"
    PUMP_NOT_CONFIGURED = "PUMP_NOT_CONFIGURED"
    PUMP_BUSY = "PUMP_BUSY"
    NOZZLE_NOT_CONFIGURED = "NOZZLE_NOT_CONFIGURED"
    DISPENSER_UNAVAILABLE = "DISPENSER_UNAVAILABLE"
    OVERRIDE_AUTHORIZED = "OVERRIDE_AUTHORIZED"
    OVERRIDE_FAILED = "OVERRIDE_FAILED"
    AUTHORIZATION_COMPLETED = "AUTHORIZATION_COMPLETED"
    AUTHORIZATION_EXPIRED = "AUTHORIZATION_EXPIRED"
    AUTHORIZATION_SUPERSEDED = "AUTHORIZATION_SUPERSEDED"


class MappingStatus(StrEnum):
    RESOLVED = "RESOLVED"
    NO_COMBUSTIBLE_FUEL = "NO_COMBUSTIBLE_FUEL"
    UNKNOWN = "UNKNOWN"
    AMBIGUOUS = "AMBIGUOUS"


class DeviceCommandType(StrEnum):
    LOCK_ALL = "LOCK_ALL"
    UNLOCK = "UNLOCK"


@dataclass(frozen=True, slots=True)
class VehicleData:
    """Resposta mínima e transitória do provedor; nunca é persistida."""

    fuel_description: str
    fuel_code: str | None = None


@dataclass(frozen=True, slots=True)
class FuelMappingResult:
    status: MappingStatus
    compatible_fuels: tuple[Fuel, ...]


@dataclass(frozen=True, slots=True)
class DeviceCommand:
    command_id: str
    type: DeviceCommandType
    pump_id: str
    issued_at: datetime
    sequence: int
    nozzle_id: str | None = None
    expires_at: datetime | None = None
    session_id: str | None = None

    @property
    def ttl_seconds(self) -> int | None:
        if self.expires_at is None:
            return None
        return max(0, int((self.expires_at - self.issued_at).total_seconds()))


@dataclass(frozen=True, slots=True)
class AuthorizationRecord:
    authorization_id: str
    status: AuthorizationStatus
    requested_fuel: Fuel
    attendant_id: str
    pump_id: str
    reason_code: ReasonCode
    provider_mode: str
    created_at: datetime
    updated_at: datetime
    expires_at: datetime | None = None
    device_command_id: str | None = None
    client_request_id: str | None = None
    request_fingerprint: str | None = None
    override_used: bool = False
    supervisor_id: str | None = None
    override_justification: str | None = None


@dataclass(frozen=True, slots=True)
class AuthorizationOutcome:
    record: AuthorizationRecord
    compatible_fuels: tuple[Fuel, ...] = ()


@dataclass(frozen=True, slots=True)
class AuditEvent:
    event_id: str
    authorization_id: str
    event_type: str
    status: AuthorizationStatus
    reason_code: ReasonCode
    created_at: datetime
    actor_id: str | None = None
    justification: str | None = None


class VehicleDataProvider(Protocol):
    mode: str

    def get_vehicle(self, plate: str) -> VehicleData: ...


class DispenserGateway(Protocol):
    def apply(self, command: DeviceCommand) -> None: ...

    def nozzle_for(self, pump_id: str, fuel: Fuel) -> str | None: ...

    def session_id_for(self, pump_id: str) -> str: ...

    def next_sequence_for(self, pump_id: str) -> int: ...


class AuthorizationRepository(Protocol):
    def add(self, record: AuthorizationRecord, event: AuditEvent) -> None: ...

    def get(self, authorization_id: str) -> AuthorizationRecord | None: ...

    def get_by_client_request_id(
        self, client_request_id: str
    ) -> AuthorizationRecord | None: ...

    def active_for_pump(self, pump_id: str) -> AuthorizationRecord | None: ...

    def active_records(self) -> list[AuthorizationRecord]: ...

    def update(self, record: AuthorizationRecord, event: AuditEvent) -> None: ...

    def events_for(self, authorization_id: str) -> list[AuditEvent]: ...


class InvalidPlateError(ValueError):
    pass


class VehicleNotFoundError(LookupError):
    pass


class ProviderTimeoutError(TimeoutError):
    pass


class ProviderUnavailableError(ConnectionError):
    pass


class DispenserError(RuntimeError):
    pass


class DispenserUnavailableError(DispenserError):
    pass


class UnknownPumpError(DispenserError):
    pass


class DuplicateCommandError(DispenserError):
    pass


class ExpiredCommandError(DispenserError):
    pass


class InvalidCommandTtlError(DispenserError):
    pass


class InvalidDeviceSessionError(DispenserError):
    pass


class StaleCommandError(DispenserError):
    pass


class AuthorizationNotFoundError(LookupError):
    pass


class InvalidAuthorizationStateError(RuntimeError):
    pass


class IdempotencyConflictError(RuntimeError):
    pass

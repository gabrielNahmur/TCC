from __future__ import annotations

from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import RLock
from uuid import uuid4

from .domain import (
    DeviceCommand,
    DeviceCommandType,
    DispenserUnavailableError,
    DuplicateCommandError,
    ExpiredCommandError,
    Fuel,
    InvalidDeviceSessionError,
    InvalidCommandTtlError,
    MAX_DEVICE_TTL_SECONDS,
    StaleCommandError,
    UnknownPumpError,
)


def _utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True, slots=True)
class DispenserSnapshot:
    pump_id: str
    online: bool
    session_id: str
    unlocked_nozzle_id: str | None
    unlock_expires_at: datetime | None
    last_sequence: int
    emergency_stop_active: bool
    transport: str = "in_memory"


@dataclass(frozen=True, slots=True)
class DispenserTrace:
    event_id: str
    timestamp: datetime
    direction: str
    event: str
    command_id: str | None = None
    command_type: str | None = None
    nozzle_id: str | None = None
    sequence: int | None = None
    result: str | None = None
    reason: str | None = None


@dataclass(slots=True)
class _PumpState:
    session_id: str
    online: bool = True
    emergency_stop_active: bool = False
    unlocked_nozzle_id: str | None = None
    unlock_expires_at: datetime | None = None
    last_sequence: int = 0
    issued_sequence: int = 0


class SimulatedDispenserGateway:
    """Simula o firmware fail-closed sem receber qualquer dado do veículo."""

    def __init__(
        self,
        catalog: dict[str, dict[Fuel, str]] | None = None,
        clock: Callable[[], datetime] = _utc_now,
    ) -> None:
        self._clock = clock
        self._catalog = catalog or {
            "pump-01": {
                Fuel.GASOLINE: "nozzle-gasoline",
                Fuel.ETHANOL: "nozzle-ethanol",
                Fuel.DIESEL_S10: "nozzle-diesel-s10",
                Fuel.DIESEL_S500: "nozzle-diesel-s500",
                Fuel.GNV: "nozzle-gnv",
            }
        }
        self._states = {
            pump_id: _PumpState(session_id=str(uuid4()))
            for pump_id in self._catalog
        }
        self._accepted_command_ids: set[str] = set()
        self._traces: dict[str, deque[DispenserTrace]] = {
            pump_id: deque(maxlen=100) for pump_id in self._catalog
        }
        self._lock = RLock()
        for pump_id in self._catalog:
            self._record(
                pump_id,
                direction="DEVICE_TO_BACKEND",
                event="DEVICE_ONLINE",
                result="LOCKED_ON_START",
            )

    def nozzle_for(self, pump_id: str, fuel: Fuel) -> str | None:
        catalog = self._catalog.get(pump_id)
        if catalog is None:
            raise UnknownPumpError(pump_id)
        return catalog.get(fuel)

    def session_id_for(self, pump_id: str) -> str:
        with self._lock:
            return self._state(pump_id).session_id

    def next_sequence_for(self, pump_id: str) -> int:
        with self._lock:
            state = self._state(pump_id)
            state.issued_sequence = max(
                state.issued_sequence, state.last_sequence
            ) + 1
            return state.issued_sequence

    def apply(self, command: DeviceCommand) -> None:
        with self._lock:
            state = self._state(command.pump_id)
            self._record(
                command.pump_id,
                direction="BACKEND_TO_DEVICE",
                event="COMMAND_SENT",
                command=command,
                result="SENT",
            )
            if command.command_id in self._accepted_command_ids:
                if command.type is DeviceCommandType.LOCK_ALL:
                    self._lock_state(state)
                self._record_ack(command, "DUPLICATE", "COMMAND_ID_ALREADY_SEEN")
                raise DuplicateCommandError(command.command_id)
            if not state.online:
                self._lock_state(state)
                self._record_ack(command, "REJECTED", "DEVICE_OFFLINE")
                raise DispenserUnavailableError(command.pump_id)
            if command.sequence <= state.last_sequence:
                self._lock_state(state)
                self._record_ack(command, "REJECTED", "STALE_SEQUENCE")
                raise StaleCommandError(command.command_id)

            now = self._clock()
            if command.type is DeviceCommandType.LOCK_ALL:
                self._accepted_command_ids.add(command.command_id)
                state.last_sequence = command.sequence
                self._lock_state(state)
                self._record_ack(command, "APPLIED")
                return

            if command.type is not DeviceCommandType.UNLOCK:
                self._record_ack(command, "REJECTED", "UNKNOWN_COMMAND")
                raise ValueError("tipo de comando não suportado")
            if state.emergency_stop_active:
                self._lock_state(state)
                self._record_ack(command, "REJECTED", "EMERGENCY_STOP_ACTIVE")
                raise DispenserUnavailableError(command.pump_id)
            if command.expires_at is None or command.expires_at <= now:
                self._record_ack(command, "REJECTED", "COMMAND_EXPIRED")
                raise ExpiredCommandError(command.command_id)
            if command.ttl_seconds is None or command.ttl_seconds > MAX_DEVICE_TTL_SECONDS:
                self._lock_state(state)
                self._record_ack(command, "REJECTED", "INVALID_TTL")
                raise InvalidCommandTtlError(command.command_id)
            if not command.nozzle_id:
                self._record_ack(command, "REJECTED", "NOZZLE_REQUIRED")
                raise ValueError("UNLOCK exige nozzle_id")
            if command.session_id != state.session_id:
                self._record_ack(command, "REJECTED", "SESSION_MISMATCH")
                raise InvalidDeviceSessionError(command.command_id)
            if command.nozzle_id not in self._catalog[command.pump_id].values():
                self._record_ack(command, "REJECTED", "NOZZLE_NOT_CONFIGURED")
                raise ValueError("bico não pertence à bomba")

            self._accepted_command_ids.add(command.command_id)
            state.last_sequence = command.sequence
            # Um novo comando válido sempre substitui o bico anterior; nunca há
            # mais de um bico liberado por bomba.
            state.unlocked_nozzle_id = command.nozzle_id
            state.unlock_expires_at = command.expires_at
            self._record_ack(command, "APPLIED")

    def snapshot(self, pump_id: str) -> DispenserSnapshot:
        with self._lock:
            state = self._state(pump_id)
            if (
                state.unlock_expires_at is not None
                and state.unlock_expires_at <= self._clock()
            ):
                self._lock_state(state)
                self._record(
                    pump_id,
                    direction="DEVICE_TO_BACKEND",
                    event="TTL_EXPIRED",
                    result="LOCKED",
                    reason="AUTHORIZATION_TTL_EXPIRED",
                )
            return DispenserSnapshot(
                pump_id=pump_id,
                online=state.online,
                session_id=state.session_id,
                unlocked_nozzle_id=state.unlocked_nozzle_id,
                unlock_expires_at=state.unlock_expires_at,
                last_sequence=state.last_sequence,
                emergency_stop_active=state.emergency_stop_active,
            )

    def set_online(self, pump_id: str, online: bool) -> None:
        with self._lock:
            state = self._state(pump_id)
            if state.online == online:
                return
            if not online:
                self._lock_state(state)
                self._record(
                    pump_id,
                    direction="DEVICE_TO_BACKEND",
                    event="DEVICE_OFFLINE",
                    result="LOCKED",
                    reason="SIMULATED_CONNECTION_LOSS",
                )
            elif not state.online:
                # Reinicialização cria uma nova sessão; comandos antigos deixam
                # de ser aceitos mesmo que ainda tenham TTL.
                state.session_id = str(uuid4())
                self._record(
                    pump_id,
                    direction="DEVICE_TO_BACKEND",
                    event="DEVICE_ONLINE",
                    result="LOCKED_ON_RECONNECT",
                )
            state.online = online

    def set_emergency_stop(self, pump_id: str, active: bool) -> None:
        with self._lock:
            state = self._state(pump_id)
            if state.emergency_stop_active == active:
                return
            state.emergency_stop_active = active
            if active:
                self._lock_state(state)
            self._record(
                pump_id,
                direction="DEVICE_TO_BACKEND",
                event="EMERGENCY_STOP" if active else "EMERGENCY_STOP_RELEASED",
                result="LOCKED" if active else "READY",
                reason="PHYSICAL_INPUT_ACTIVE" if active else "PHYSICAL_INPUT_RELEASED",
            )

    def traces(self, pump_id: str) -> tuple[DispenserTrace, ...]:
        with self._lock:
            self._state(pump_id)
            return tuple(self._traces[pump_id])

    def clear_traces(self, pump_id: str) -> None:
        with self._lock:
            self._state(pump_id)
            self._traces[pump_id].clear()

    def configured_nozzles(self, pump_id: str) -> dict[Fuel, str]:
        with self._lock:
            self._state(pump_id)
            return dict(self._catalog[pump_id])

    def _state(self, pump_id: str) -> _PumpState:
        try:
            return self._states[pump_id]
        except KeyError as exc:
            raise UnknownPumpError(pump_id) from exc

    @staticmethod
    def _lock_state(state: _PumpState) -> None:
        state.unlocked_nozzle_id = None
        state.unlock_expires_at = None

    def _record_ack(
        self, command: DeviceCommand, result: str, reason: str | None = None
    ) -> None:
        self._record(
            command.pump_id,
            direction="DEVICE_TO_BACKEND",
            event="COMMAND_ACK",
            command=command,
            result=result,
            reason=reason,
        )

    def _record(
        self,
        pump_id: str,
        *,
        direction: str,
        event: str,
        command: DeviceCommand | None = None,
        result: str | None = None,
        reason: str | None = None,
    ) -> None:
        self._traces[pump_id].append(
            DispenserTrace(
                event_id=str(uuid4()),
                timestamp=self._clock(),
                direction=direction,
                event=event,
                command_id=command.command_id if command else None,
                command_type=command.type.value if command else None,
                nozzle_id=command.nozzle_id if command else None,
                sequence=command.sequence if command else None,
                result=result,
                reason=reason,
            )
        )

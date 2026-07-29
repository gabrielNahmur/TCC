from __future__ import annotations

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


@dataclass(slots=True)
class _PumpState:
    session_id: str
    online: bool = True
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
        self._lock = RLock()

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
            if command.command_id in self._accepted_command_ids:
                if command.type is DeviceCommandType.LOCK_ALL:
                    self._lock_state(state)
                raise DuplicateCommandError(command.command_id)
            if not state.online:
                self._lock_state(state)
                raise DispenserUnavailableError(command.pump_id)
            if command.sequence <= state.last_sequence:
                self._lock_state(state)
                raise StaleCommandError(command.command_id)

            now = self._clock()
            if command.type is DeviceCommandType.LOCK_ALL:
                self._accepted_command_ids.add(command.command_id)
                state.last_sequence = command.sequence
                self._lock_state(state)
                return

            if command.type is not DeviceCommandType.UNLOCK:
                raise ValueError("tipo de comando não suportado")
            if command.expires_at is None or command.expires_at <= now:
                raise ExpiredCommandError(command.command_id)
            if command.ttl_seconds is None or command.ttl_seconds > MAX_DEVICE_TTL_SECONDS:
                self._lock_state(state)
                raise InvalidCommandTtlError(command.command_id)
            if not command.nozzle_id:
                raise ValueError("UNLOCK exige nozzle_id")
            if command.session_id != state.session_id:
                raise InvalidDeviceSessionError(command.command_id)
            if command.nozzle_id not in self._catalog[command.pump_id].values():
                raise ValueError("bico não pertence à bomba")

            self._accepted_command_ids.add(command.command_id)
            state.last_sequence = command.sequence
            # Um novo comando válido sempre substitui o bico anterior; nunca há
            # mais de um bico liberado por bomba.
            state.unlocked_nozzle_id = command.nozzle_id
            state.unlock_expires_at = command.expires_at

    def snapshot(self, pump_id: str) -> DispenserSnapshot:
        with self._lock:
            state = self._state(pump_id)
            if (
                state.unlock_expires_at is not None
                and state.unlock_expires_at <= self._clock()
            ):
                self._lock_state(state)
            return DispenserSnapshot(
                pump_id=pump_id,
                online=state.online,
                session_id=state.session_id,
                unlocked_nozzle_id=state.unlocked_nozzle_id,
                unlock_expires_at=state.unlock_expires_at,
            )

    def set_online(self, pump_id: str, online: bool) -> None:
        with self._lock:
            state = self._state(pump_id)
            if not online:
                self._lock_state(state)
            elif not state.online:
                # Reinicialização cria uma nova sessão; comandos antigos deixam
                # de ser aceitos mesmo que ainda tenham TTL.
                state.session_id = str(uuid4())
            state.online = online

    def _state(self, pump_id: str) -> _PumpState:
        try:
            return self._states[pump_id]
        except KeyError as exc:
            raise UnknownPumpError(pump_id) from exc

    @staticmethod
    def _lock_state(state: _PumpState) -> None:
        state.unlocked_nozzle_id = None
        state.unlock_expires_at = None

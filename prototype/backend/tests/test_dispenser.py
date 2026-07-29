from __future__ import annotations

from datetime import timedelta

import pytest

from app.dispenser import SimulatedDispenserGateway
from app.domain import (
    DeviceCommand,
    DeviceCommandType,
    DispenserUnavailableError,
    DuplicateCommandError,
    ExpiredCommandError,
    InvalidDeviceSessionError,
    InvalidCommandTtlError,
    StaleCommandError,
)


def _unlock(
    api,
    *,
    command_id: str = "cmd-1",
    session_id: str | None = None,
    ttl_seconds: int = 30,
):
    now = api.clock()
    return DeviceCommand(
        command_id=command_id,
        type=DeviceCommandType.UNLOCK,
        pump_id="pump-01",
        sequence=api.gateway.next_sequence_for("pump-01"),
        nozzle_id="nozzle-gasoline",
        issued_at=now,
        expires_at=now + timedelta(seconds=ttl_seconds),
        session_id=session_id or api.gateway.session_id_for("pump-01"),
    )


def test_duplicate_unlock_is_rejected_and_does_not_extend_ttl(api) -> None:
    command = _unlock(api)
    api.gateway.apply(command)
    api.clock.advance(seconds=20)

    with pytest.raises(DuplicateCommandError):
        api.gateway.apply(command)

    api.clock.advance(seconds=11)
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id is None


def test_expired_command_is_rejected(api) -> None:
    command = _unlock(api)
    api.clock.advance(seconds=31)

    with pytest.raises(ExpiredCommandError):
        api.gateway.apply(command)

    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id is None


def test_ttl_above_firmware_contract_is_rejected(api) -> None:
    with pytest.raises(InvalidCommandTtlError):
        api.gateway.apply(_unlock(api, ttl_seconds=121))

    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id is None


def test_old_device_session_is_rejected_after_reconnect(api) -> None:
    old_session = api.gateway.session_id_for("pump-01")
    api.gateway.set_online("pump-01", False)
    api.gateway.set_online("pump-01", True)

    with pytest.raises(InvalidDeviceSessionError):
        api.gateway.apply(_unlock(api, session_id=old_session))


def test_connection_loss_locks_and_rejects_commands(api) -> None:
    api.gateway.apply(_unlock(api))
    api.gateway.set_online("pump-01", False)

    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id is None
    with pytest.raises(DispenserUnavailableError):
        api.gateway.apply(_unlock(api, command_id="cmd-offline"))


def test_new_unlock_replaces_previous_nozzle_instead_of_accumulating(api) -> None:
    api.gateway.apply(_unlock(api))
    now = api.clock()
    api.gateway.apply(
        DeviceCommand(
            command_id="cmd-2",
            type=DeviceCommandType.UNLOCK,
            pump_id="pump-01",
            sequence=api.gateway.next_sequence_for("pump-01"),
            nozzle_id="nozzle-ethanol",
            issued_at=now,
            expires_at=now + timedelta(seconds=30),
            session_id=api.gateway.session_id_for("pump-01"),
        )
    )

    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id == "nozzle-ethanol"


def test_delayed_unlock_cannot_reopen_after_newer_lock(api) -> None:
    delayed_unlock = _unlock(api, command_id="cmd-delayed")
    now = api.clock()
    newer_lock = DeviceCommand(
        command_id="cmd-lock-newer",
        type=DeviceCommandType.LOCK_ALL,
        pump_id="pump-01",
        issued_at=now,
        sequence=api.gateway.next_sequence_for("pump-01"),
    )
    api.gateway.apply(newer_lock)

    with pytest.raises(StaleCommandError):
        api.gateway.apply(delayed_unlock)

    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id is None

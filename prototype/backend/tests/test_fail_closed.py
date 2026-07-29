from __future__ import annotations

import pytest

from app.dispenser import SimulatedDispenserGateway
from app.domain import (
    AuthorizationStatus,
    DeviceCommandType,
    DispenserUnavailableError,
    Fuel,
)
from app.providers import MockVehicleDataProvider
from app.repository import SqliteAuthorizationRepository
from app.service import AuthorizationService


class FailingRepository:
    def add(self, record, event) -> None:
        raise RuntimeError("falha sintética de persistência")

    def get(self, authorization_id):
        return None

    def get_by_client_request_id(self, client_request_id):
        return None

    def active_for_pump(self, pump_id):
        return None

    def active_records(self):
        return []

    def update(self, record, event) -> None:
        raise RuntimeError("falha sintética de persistência")

    def events_for(self, authorization_id):
        return []


def test_persistence_failure_before_intent_never_unlocks(api) -> None:
    gateway = SimulatedDispenserGateway(clock=api.clock)
    service = AuthorizationService(
        provider=MockVehicleDataProvider(),
        gateway=gateway,
        repository=FailingRepository(),
        clock=api.clock,
    )

    try:
        service.authorize(
            plate="AAA1A11",
            requested_fuel=Fuel.GASOLINE,
            attendant_id="attendant-01",
            pump_id="pump-01",
        )
    except RuntimeError as exc:
        assert str(exc) == "falha sintética de persistência"
    else:
        raise AssertionError("a falha de persistência deveria ser propagada")

    assert gateway.snapshot("pump-01").unlocked_nozzle_id is None


class FailingAckRepository(SqliteAuthorizationRepository):
    def update(self, record, event) -> None:
        raise RuntimeError("falha sintética ao persistir ACK")


class FailingCompensatingLockGateway(SimulatedDispenserGateway):
    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self._unlock_was_applied = False

    def apply(self, command) -> None:
        if self._unlock_was_applied and command.type is DeviceCommandType.LOCK_ALL:
            raise DispenserUnavailableError(command.pump_id)
        super().apply(command)
        if command.type is DeviceCommandType.UNLOCK:
            self._unlock_was_applied = True


class AckLostAfterUnlockGateway(SimulatedDispenserGateway):
    def __init__(self, *, unexpected: bool = False, **kwargs) -> None:
        super().__init__(**kwargs)
        self._unexpected = unexpected

    def apply(self, command) -> None:
        super().apply(command)
        if command.type is DeviceCommandType.UNLOCK:
            if self._unexpected:
                raise RuntimeError("falha inesperada depois do UNLOCK")
            raise DispenserUnavailableError("ACK perdido depois do UNLOCK")


class FailSecondSequenceGateway(SimulatedDispenserGateway):
    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self._sequence_calls = 0

    def next_sequence_for(self, pump_id: str) -> int:
        self._sequence_calls += 1
        if self._sequence_calls == 2:
            raise RuntimeError("falha antes de persistir intent")
        return super().next_sequence_for(pump_id)


def test_failed_ack_persistence_keeps_intent_and_ttl_limits_exposure(api) -> None:
    gateway = FailingCompensatingLockGateway(clock=api.clock)
    repository = FailingAckRepository(":memory:")
    service = AuthorizationService(
        provider=MockVehicleDataProvider(),
        gateway=gateway,
        repository=repository,
        ttl_seconds=30,
        clock=api.clock,
    )

    with pytest.raises(RuntimeError, match="persistir ACK"):
        service.authorize(
            plate="AAA1A11",
            requested_fuel=Fuel.GASOLINE,
            attendant_id="attendant-01",
            pump_id="pump-01",
        )

    intent = repository.active_for_pump("pump-01")
    assert intent is not None
    assert intent.status is AuthorizationStatus.PENDING_DEVICE
    assert intent.device_command_id is not None
    assert gateway.snapshot("pump-01").unlocked_nozzle_id == "nozzle-gasoline"

    api.clock.advance(seconds=31)
    assert gateway.snapshot("pump-01").unlocked_nozzle_id is None
    repository.close()


def test_device_restart_starts_locked_and_new_flow_supersedes_old_record(api) -> None:
    old = api.client.post(
        "/api/v1/authorizations",
        json={
            "plate": "AAA1A11",
            "requested_fuel": "GASOLINE",
            "attendant_id": "attendant-01",
            "pump_id": "pump-01",
        },
    ).json()

    restarted_gateway = SimulatedDispenserGateway(clock=api.clock)
    assert restarted_gateway.snapshot("pump-01").unlocked_nozzle_id is None
    restarted_service = AuthorizationService(
        provider=MockVehicleDataProvider(),
        gateway=restarted_gateway,
        repository=api.repository,
        ttl_seconds=30,
        clock=api.clock,
    )
    restarted_service.reconcile_startup()
    new_outcome = restarted_service.authorize(
        plate="BBB2B22",
        requested_fuel=Fuel.ETHANOL,
        attendant_id="attendant-02",
        pump_id="pump-01",
    )

    previous = api.repository.get(old["authorization_id"])
    assert previous is not None
    assert previous.status is AuthorizationStatus.EXPIRED
    assert new_outcome.record.status is AuthorizationStatus.AUTHORIZED
    assert restarted_gateway.snapshot("pump-01").unlocked_nozzle_id == "nozzle-ethanol"


@pytest.mark.parametrize("unexpected", [False, True])
def test_ack_loss_after_unlock_triggers_compensating_lock(api, unexpected) -> None:
    gateway = AckLostAfterUnlockGateway(unexpected=unexpected, clock=api.clock)
    repository = SqliteAuthorizationRepository(":memory:")
    service = AuthorizationService(
        provider=MockVehicleDataProvider(),
        gateway=gateway,
        repository=repository,
        ttl_seconds=30,
        clock=api.clock,
    )
    request_id = "66666666-6666-4666-8666-666666666666"
    try:
        if unexpected:
            with pytest.raises(RuntimeError, match="depois do UNLOCK"):
                service.authorize(
                    plate="AAA1A11",
                    requested_fuel=Fuel.GASOLINE,
                    attendant_id="attendant-ack",
                    pump_id="pump-01",
                    client_request_id=request_id,
                )
        else:
            outcome = service.authorize(
                plate="AAA1A11",
                requested_fuel=Fuel.GASOLINE,
                attendant_id="attendant-ack",
                pump_id="pump-01",
                client_request_id=request_id,
            )
            assert outcome.record.status is AuthorizationStatus.REVIEW_REQUIRED

        persisted = repository.get_by_client_request_id(request_id)
        assert persisted is not None
        assert persisted.status is AuthorizationStatus.REVIEW_REQUIRED
        assert gateway.snapshot("pump-01").unlocked_nozzle_id is None
    finally:
        repository.close()


def test_override_ack_loss_after_unlock_triggers_compensating_lock(api) -> None:
    gateway = AckLostAfterUnlockGateway(clock=api.clock)
    repository = SqliteAuthorizationRepository(":memory:")
    service = AuthorizationService(
        provider=MockVehicleDataProvider(),
        gateway=gateway,
        repository=repository,
        ttl_seconds=30,
        clock=api.clock,
    )
    try:
        review = service.authorize(
            plate="TTT1T11",
            requested_fuel=Fuel.GASOLINE,
            attendant_id="attendant-override",
            pump_id="pump-01",
        ).record
        failed = service.override(
            review.authorization_id,
            supervisor_id="supervisor-01",
            justification="PROVIDER_CONTINGENCY_CONFIRMED",
        )

        assert failed.status is AuthorizationStatus.REVIEW_REQUIRED
        assert gateway.snapshot("pump-01").unlocked_nozzle_id is None
    finally:
        repository.close()


def test_override_unexpected_error_before_intent_remains_locked(api) -> None:
    gateway = FailSecondSequenceGateway(clock=api.clock)
    repository = SqliteAuthorizationRepository(":memory:")
    service = AuthorizationService(
        provider=MockVehicleDataProvider(),
        gateway=gateway,
        repository=repository,
        ttl_seconds=30,
        clock=api.clock,
    )
    try:
        review = service.authorize(
            plate="TTT1T11",
            requested_fuel=Fuel.GASOLINE,
            attendant_id="attendant-override",
            pump_id="pump-01",
        ).record
        with pytest.raises(RuntimeError, match="antes de persistir intent"):
            service.override(
                review.authorization_id,
                supervisor_id="supervisor-01",
                justification="PROVIDER_CONTINGENCY_CONFIRMED",
            )

        persisted = repository.get(review.authorization_id)
        assert persisted is not None
        assert persisted.status is AuthorizationStatus.REVIEW_REQUIRED
        assert gateway.snapshot("pump-01").unlocked_nozzle_id is None
    finally:
        repository.close()

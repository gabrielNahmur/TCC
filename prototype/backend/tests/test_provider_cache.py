from __future__ import annotations

from app.dispenser import SimulatedDispenserGateway
from app.domain import Fuel
from app.providers import MockVehicleDataProvider
from app.repository import SqliteAuthorizationRepository
from app.service import AuthorizationService


class CountingProvider(MockVehicleDataProvider):
    def __init__(self) -> None:
        self.calls = 0

    def get_vehicle(self, plate: str):
        self.calls += 1
        return super().get_vehicle(plate)


def test_compatibility_then_authorization_uses_one_provider_query(api) -> None:
    provider = CountingProvider()
    repository = SqliteAuthorizationRepository(":memory:")
    service = AuthorizationService(
        provider=provider,
        gateway=SimulatedDispenserGateway(clock=api.clock),
        repository=repository,
        ttl_seconds=30,
        clock=api.clock,
    )
    try:
        service.check_compatibility("AAA1A11")
        outcome = service.authorize(
            plate="AAA1A11",
            requested_fuel=Fuel.GASOLINE,
            attendant_id="attendant-cache",
            pump_id="pump-01",
            client_request_id="44444444-4444-4444-8444-444444444444",
        )

        assert outcome.record.status.value == "AUTHORIZED"
        assert provider.calls == 1
    finally:
        repository.close()


def test_compatibility_cache_expires(api) -> None:
    provider = CountingProvider()
    repository = SqliteAuthorizationRepository(":memory:")
    service = AuthorizationService(
        provider=provider,
        gateway=SimulatedDispenserGateway(clock=api.clock),
        repository=repository,
        ttl_seconds=30,
        clock=api.clock,
    )
    try:
        service.check_compatibility("AAA1A11")
        api.clock.advance(seconds=31)
        service.check_compatibility("AAA1A11")
        assert provider.calls == 2
    finally:
        repository.close()

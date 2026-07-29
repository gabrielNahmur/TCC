from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.dispenser import SimulatedDispenserGateway
from app.main import create_app
from app.providers import MockVehicleDataProvider
from app.repository import SqliteAuthorizationRepository


SUPERVISOR_TOKEN = "test-supervisor-token-with-safe-length"


class MutableClock:
    def __init__(self) -> None:
        self.current = datetime(2026, 7, 29, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.current

    def advance(self, *, seconds: int) -> None:
        self.current += timedelta(seconds=seconds)


@dataclass(slots=True)
class ApiContext:
    client: TestClient
    clock: MutableClock
    gateway: SimulatedDispenserGateway
    repository: SqliteAuthorizationRepository

    @property
    def supervisor_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {SUPERVISOR_TOKEN}"}


@pytest.fixture
def api() -> ApiContext:
    clock = MutableClock()
    gateway = SimulatedDispenserGateway(clock=clock)
    repository = SqliteAuthorizationRepository(":memory:")
    settings = Settings(
        database_path=":memory:",
        supervisor_token=SUPERVISOR_TOKEN,
        authorization_ttl_seconds=30,
    )
    app = create_app(
        settings=settings,
        provider=MockVehicleDataProvider(),
        gateway=gateway,
        repository=repository,
        clock=clock,
    )
    with TestClient(app) as client:
        yield ApiContext(client, clock, gateway, repository)


@pytest.fixture
def authorization_payload() -> dict[str, str]:
    return {
        "plate": "AAA1A11",
        "requested_fuel": "GASOLINE",
        "attendant_id": "attendant-01",
        "pump_id": "pump-01",
    }

from __future__ import annotations

import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.config import BACKEND_ROOT, DEFAULT_DEVELOPMENT_TOKEN, Settings
from app.dispenser import SimulatedDispenserGateway
from app.domain import Fuel
from app.providers import MockVehicleDataProvider
from app.main import create_app
from app.repository import SqliteAuthorizationRepository
from app.service import AuthorizationService


def test_database_schema_has_no_vehicle_identifier_or_raw_response(api) -> None:
    columns = set(api.repository.table_columns("authorizations")) | set(
        api.repository.table_columns("audit_events")
    )
    forbidden = {
        "plate",
        "placa",
        "renavam",
        "chassis",
        "chassi",
        "owner",
        "proprietario",
        "raw_response",
        "vehicle_response",
        "compatible_fuels",
    }

    assert columns.isdisjoint(forbidden)


def test_database_enforces_foreign_keys(api) -> None:
    assert api.repository.foreign_keys_enabled() is True


def test_legacy_empty_database_receives_additive_migration(tmp_path) -> None:
    database_path = tmp_path / "legacy.db"
    connection = sqlite3.connect(database_path)
    connection.executescript(
        """
        CREATE TABLE authorizations (
            authorization_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            requested_fuel TEXT NOT NULL,
            attendant_id TEXT NOT NULL,
            pump_id TEXT NOT NULL,
            reason_code TEXT NOT NULL,
            provider_mode TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            expires_at TEXT,
            override_used INTEGER NOT NULL DEFAULT 0,
            supervisor_id TEXT,
            override_justification TEXT
        );
        CREATE TABLE audit_events (
            event_id TEXT PRIMARY KEY,
            authorization_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            status TEXT NOT NULL,
            reason_code TEXT NOT NULL,
            created_at TEXT NOT NULL,
            actor_id TEXT,
            justification TEXT
        );
        CREATE UNIQUE INDEX uq_authorization_active_pump
            ON authorizations(pump_id) WHERE status = 'AUTHORIZED';
        """
    )
    connection.close()

    repository = SqliteAuthorizationRepository(str(database_path))
    try:
        assert {
            "device_command_id",
            "client_request_id",
            "request_fingerprint",
        }.issubset(set(repository.table_columns("authorizations")))
        service = AuthorizationService(
            provider=MockVehicleDataProvider(),
            gateway=SimulatedDispenserGateway(),
            repository=repository,
        )
        outcome = service.authorize(
            plate="AAA1A11",
            requested_fuel=Fuel.GASOLINE,
            attendant_id="attendant-legacy",
            pump_id="pump-01",
            client_request_id="33333333-3333-4333-8333-333333333333",
        )
        assert outcome.record.status.value == "AUTHORIZED"
    finally:
        repository.close()


def test_real_provider_mode_is_refused_at_configuration_boundary() -> None:
    settings = Settings(provider_mode="senatran")

    with pytest.raises(RuntimeError, match="Somente PROVIDER_MODE=mock"):
        settings.validate()


def test_default_supervisor_token_is_refused_in_production() -> None:
    settings = Settings(
        environment="production", supervisor_token=DEFAULT_DEVELOPMENT_TOKEN
    )

    with pytest.raises(RuntimeError, match="SUPERVISOR_TOKEN"):
        settings.validate()


def test_short_supervisor_token_is_refused() -> None:
    settings = Settings(supervisor_token="short")

    with pytest.raises(ValueError, match="pelo menos 20"):
        settings.validate()


def test_short_idempotency_secret_is_refused() -> None:
    settings = Settings(idempotency_hmac_secret="short")

    with pytest.raises(ValueError, match="IDEMPOTENCY_HMAC_SECRET"):
        settings.validate()


def test_ttl_above_firmware_limit_is_refused() -> None:
    settings = Settings(authorization_ttl_seconds=121)

    with pytest.raises(ValueError, match="entre 5 e 120"):
        settings.validate()


def test_prototype_refuses_non_loopback_client() -> None:
    app = create_app(
        settings=Settings(
            database_path=":memory:",
            supervisor_token="test-supervisor-token-with-safe-length",
            idempotency_hmac_secret="stable-test-idempotency-secret-32-chars",
        )
    )

    with TestClient(app, client=("203.0.113.10", 50000)) as client:
        response = client.get("/health")

    assert response.status_code == 403


def test_default_database_path_does_not_depend_on_current_directory(
    tmp_path, monkeypatch
) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("DATABASE_PATH", raising=False)

    settings = Settings.from_env()

    assert settings.database_path == str((BACKEND_ROOT / "data" / "tcc.db").resolve())

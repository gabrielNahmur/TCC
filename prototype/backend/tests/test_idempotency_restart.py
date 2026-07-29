from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_same_request_can_be_reconciled_after_backend_restart(tmp_path) -> None:
    settings = Settings(
        database_path=str(tmp_path / "restart.db"),
        supervisor_token="test-supervisor-token-with-safe-length",
        idempotency_hmac_secret="stable-test-idempotency-secret-32-chars",
    )
    payload = {
        "client_request_id": "55555555-5555-4555-8555-555555555555",
        "plate": "AAA1A11",
        "requested_fuel": "GASOLINE",
        "attendant_id": "attendant-restart",
        "pump_id": "pump-01",
    }

    with TestClient(create_app(settings=settings)) as client:
        first = client.post("/api/v1/authorizations", json=payload)
        assert first.status_code == 201
        first_body = first.json()
        assert first_body["status"] == "AUTHORIZED"

    with TestClient(create_app(settings=settings)) as client:
        reconciled = client.post("/api/v1/authorizations", json=payload)

    assert reconciled.status_code == 201
    assert reconciled.json()["authorization_id"] == first_body["authorization_id"]
    assert reconciled.json()["status"] == "EXPIRED"

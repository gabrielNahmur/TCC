from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from app.domain import Fuel

import pytest


def test_health_identifies_mock_mode(api) -> None:
    response = api.client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "provider_mode": "mock"}
    assert response.headers["cache-control"] == "no-store"


def test_compatibility_check_returns_flex_options_without_vehicle_summary(api) -> None:
    response = api.client.post(
        "/api/v1/compatibility-checks", json={"plate": "CCC-3C33"}
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "AUTHORIZED",
        "compatible_fuels": ["GASOLINE", "ETHANOL"],
        "reason_code": "FUEL_COMPATIBLE",
        "provider_mode": "mock",
    }
    assert "CCC3C33" not in response.text


def test_validation_errors_do_not_echo_the_plate(api) -> None:
    sensitive_input = "INVALIDA"
    response = api.client.post(
        "/api/v1/compatibility-checks", json={"plate": sensitive_input}
    )

    assert response.status_code == 422
    assert sensitive_input not in response.text
    assert all("input" not in item for item in response.json()["detail"])


def test_authorizes_only_compatible_nozzle(api, authorization_payload) -> None:
    response = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "AUTHORIZED"
    assert body["reason_code"] == "FUEL_COMPATIBLE"
    assert body["compatible_fuels"] == ["GASOLINE"]
    assert body["expires_at"] is not None
    assert "plate" not in body
    state = api.gateway.snapshot("pump-01")
    assert state.unlocked_nozzle_id == "nozzle-gasoline"


def test_same_client_request_id_returns_existing_decision_without_second_unlock(
    api, authorization_payload
) -> None:
    authorization_payload["plate"] = "CCC3C33"
    authorization_payload["client_request_id"] = (
        "11111111-1111-4111-8111-111111111111"
    )
    first = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    )
    second = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert second.json()["authorization_id"] == first.json()["authorization_id"]
    assert second.json()["client_request_id"] == authorization_payload[
        "client_request_id"
    ]
    assert second.json()["compatible_fuels"] == first.json()["compatible_fuels"]
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id == "nozzle-gasoline"


@pytest.mark.parametrize(
    "changed",
    [
        {"plate": "BBB2B22"},
        {"requested_fuel": "ETHANOL"},
        {"attendant_id": "attendant-02"},
    ],
)
def test_reused_client_request_id_with_different_payload_is_conflict(
    api, authorization_payload, changed
) -> None:
    authorization_payload["client_request_id"] = (
        "22222222-2222-4222-8222-222222222222"
    )
    first = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    )
    assert first.status_code == 201

    response = api.client.post(
        "/api/v1/authorizations",
        json={**authorization_payload, **changed},
    )

    assert response.status_code == 409
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id == "nozzle-gasoline"


def test_invalid_plate_with_reused_request_id_fails_closed_before_conflict(
    api, authorization_payload
) -> None:
    authorization_payload["client_request_id"] = (
        "99999999-9999-4999-8999-999999999999"
    )
    active = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    ).json()
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id == "nozzle-gasoline"

    response = api.client.post(
        "/api/v1/authorizations",
        json={**authorization_payload, "plate": "INVALIDA"},
    )

    assert response.status_code == 409
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id is None
    previous = api.repository.get(active["authorization_id"])
    assert previous is not None
    assert previous.status.value == "SUPERSEDED"


def test_denied_idempotent_retry_preserves_compatible_fuels(
    api, authorization_payload
) -> None:
    authorization_payload.update(
        {
            "client_request_id": "77777777-7777-4777-8777-777777777777",
            "requested_fuel": "ETHANOL",
        }
    )
    first = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    )
    second = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["status"] == "DENIED"
    assert second.json()["compatible_fuels"] == first.json()["compatible_fuels"]


def test_incompatible_fuel_is_denied_and_pump_remains_locked(
    api, authorization_payload
) -> None:
    authorization_payload["requested_fuel"] = "DIESEL_S10"

    response = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    )

    assert response.status_code == 201
    assert response.json()["status"] == "DENIED"
    assert response.json()["reason_code"] == "FUEL_INCOMPATIBLE"
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id is None


@pytest.mark.parametrize(
    ("plate", "expected_status", "reason"),
    [
        ("ZZZ9Z99", "REVIEW_REQUIRED", "VEHICLE_NOT_FOUND"),
        ("TTT1T11", "REVIEW_REQUIRED", "PROVIDER_TIMEOUT"),
        ("UUU2U22", "REVIEW_REQUIRED", "PROVIDER_UNAVAILABLE"),
        ("HHH8H88", "REVIEW_REQUIRED", "FUEL_MAPPING_AMBIGUOUS"),
        ("GGG7G77", "REVIEW_REQUIRED", "FUEL_MAPPING_AMBIGUOUS"),
        ("JJJ9J99", "REVIEW_REQUIRED", "FUEL_MAPPING_AMBIGUOUS"),
        ("FFF6F66", "DENIED", "NO_COMBUSTIBLE_FUEL"),
    ],
)
def test_provider_and_mapping_failures_never_unlock(
    api, authorization_payload, plate, expected_status, reason
) -> None:
    authorization_payload["plate"] = plate

    response = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    )

    assert response.status_code == 201
    assert response.json()["status"] == expected_status
    assert response.json()["reason_code"] == reason
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id is None


def test_invalid_plate_locks_and_supersedes_previous_authorization(
    api, authorization_payload
) -> None:
    active = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    ).json()
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id == "nozzle-gasoline"

    authorization_payload["plate"] = "INVALIDA"
    response = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    )

    assert response.status_code == 201
    assert response.json()["status"] == "REVIEW_REQUIRED"
    assert response.json()["reason_code"] == "INVALID_PLATE"
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id is None
    previous = api.client.get(
        f"/api/v1/authorizations/{active['authorization_id']}"
    ).json()
    assert previous["status"] == "SUPERSEDED"


@pytest.mark.parametrize(
    "invalid_fields",
    [
        {"plate": "A" * 33},
        {"plate": None},
        {"requested_fuel": "KEROSENE"},
    ],
)
def test_schema_invalid_authorization_still_locks_identified_pump(
    api, authorization_payload, invalid_fields
) -> None:
    active = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    ).json()
    payload = {**authorization_payload, **invalid_fields}
    if "plate" in invalid_fields and invalid_fields["plate"] is None:
        payload.pop("plate")

    response = api.client.post("/api/v1/authorizations", json=payload)

    assert response.status_code == 422
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id is None
    previous = api.repository.get(active["authorization_id"])
    assert previous is not None
    assert previous.status.value == "SUPERSEDED"


def test_unknown_pump_requires_review(api, authorization_payload) -> None:
    authorization_payload["pump_id"] = "pump-99"

    response = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    )

    assert response.status_code == 201
    assert response.json()["status"] == "REVIEW_REQUIRED"
    assert response.json()["reason_code"] == "PUMP_NOT_CONFIGURED"


def test_offline_dispenser_requires_review_and_stays_locked(
    api, authorization_payload
) -> None:
    api.gateway.set_online("pump-01", False)

    response = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    )

    assert response.status_code == 201
    assert response.json()["reason_code"] == "DISPENSER_UNAVAILABLE"
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id is None


def test_override_cannot_bypass_an_offline_dispenser_decision(
    api, authorization_payload
) -> None:
    authorization_payload["plate"] = "FFF6F66"
    authorization_payload["requested_fuel"] = "GASOLINE"
    api.gateway.set_online("pump-01", False)
    created = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    ).json()
    assert created["status"] == "REVIEW_REQUIRED"
    assert created["reason_code"] == "DISPENSER_UNAVAILABLE"

    api.gateway.set_online("pump-01", True)
    response = api.client.post(
        f"/api/v1/authorizations/{created['authorization_id']}/override",
        json={
            "supervisor_id": "supervisor-01",
            "justification": "Falha de dispositivo exige uma nova consulta completa",
        },
        headers=api.supervisor_headers,
    )

    assert response.status_code == 409
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id is None


def test_override_cannot_bypass_an_unknown_pump_decision(
    api, authorization_payload
) -> None:
    authorization_payload["pump_id"] = "pump-99"
    created = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    ).json()
    assert created["reason_code"] == "PUMP_NOT_CONFIGURED"

    response = api.client.post(
        f"/api/v1/authorizations/{created['authorization_id']}/override",
        json={
            "supervisor_id": "supervisor-01",
            "justification": "Bomba desconhecida jamais pode ser liberada por excecao",
        },
        headers=api.supervisor_headers,
    )

    assert response.status_code == 409


def test_authorization_expires_and_returns_to_locked_state(
    api, authorization_payload
) -> None:
    created = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    ).json()
    api.clock.advance(seconds=31)

    response = api.client.get(
        f"/api/v1/authorizations/{created['authorization_id']}"
    )

    assert response.status_code == 200
    assert response.json()["status"] == "EXPIRED"
    assert response.json()["reason_code"] == "AUTHORIZATION_EXPIRED"
    assert response.json()["expires_at"] is None
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id is None


def test_second_active_authorization_for_same_pump_is_rejected(
    api, authorization_payload
) -> None:
    first = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    ).json()
    second_payload = {
        **authorization_payload,
        "plate": "BBB2B22",
        "requested_fuel": "ETHANOL",
    }
    second = api.client.post(
        "/api/v1/authorizations", json=second_payload
    ).json()

    assert first["status"] == "AUTHORIZED"
    assert second["status"] == "REVIEW_REQUIRED"
    assert second["reason_code"] == "PUMP_BUSY"
    persisted_first = api.client.get(
        f"/api/v1/authorizations/{first['authorization_id']}"
    ).json()
    assert persisted_first["status"] == "AUTHORIZED"
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id == "nozzle-gasoline"


def test_concurrent_authorizations_leave_exactly_one_active_nozzle(api) -> None:
    barrier = Barrier(2)
    service = api.client.app.state.service

    def request(plate: str, fuel: Fuel):
        barrier.wait()
        return service.authorize(
            plate=plate,
            requested_fuel=fuel,
            attendant_id="attendant-concurrent",
            pump_id="pump-01",
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(request, "AAA1A11", Fuel.GASOLINE),
            executor.submit(request, "BBB2B22", Fuel.ETHANOL),
        ]
        outcomes = [future.result() for future in futures]

    assert sorted(outcome.record.status.value for outcome in outcomes) == [
        "AUTHORIZED",
        "REVIEW_REQUIRED",
    ]
    active = api.repository.active_for_pump("pump-01")
    assert active is not None
    expected_nozzle = {
        Fuel.GASOLINE: "nozzle-gasoline",
        Fuel.ETHANOL: "nozzle-ethanol",
    }[active.requested_fuel]
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id == expected_nozzle


def test_complete_locks_active_authorization(api, authorization_payload) -> None:
    created = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    ).json()

    response = api.client.post(
        f"/api/v1/authorizations/{created['authorization_id']}/complete",
        json={"actor_id": "attendant-01"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "COMPLETED"
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id is None


def test_supervisor_override_requires_bearer_and_is_audited(
    api, authorization_payload
) -> None:
    authorization_payload["plate"] = "TTT1T11"
    authorization_payload["requested_fuel"] = "DIESEL_S10"
    created = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    ).json()
    endpoint = f"/api/v1/authorizations/{created['authorization_id']}/override"
    payload = {
        "supervisor_id": "supervisor-01",
        "justification": "Procedimento excepcional confirmado em bancada",
    }

    assert api.client.post(endpoint, json=payload).status_code == 401
    assert (
        api.client.post(
            endpoint,
            json=payload,
            headers={"Authorization": "Bearer token-incorreto-longo"},
        ).status_code
        == 401
    )

    response = api.client.post(
        endpoint, json=payload, headers=api.supervisor_headers
    )

    assert response.status_code == 200
    assert response.json()["status"] == "AUTHORIZED"
    assert response.json()["reason_code"] == "OVERRIDE_AUTHORIZED"
    assert response.json()["override_used"] is True
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id == "nozzle-diesel-s10"

    audit = api.client.get(
        f"/api/v1/authorizations/{created['authorization_id']}/audit",
        headers=api.supervisor_headers,
    )
    assert audit.status_code == 200
    assert [event["event_type"] for event in audit.json()] == [
        "AUTHORIZATION_DECIDED",
        "OVERRIDE_DEVICE_INTENT",
        "OVERRIDE_DEVICE_ACK",
    ]
    assert audit.json()[-1]["actor_id"] == "supervisor-01"
    assert audit.json()[-1]["justification"] == payload["justification"]

    duplicate = api.client.post(
        endpoint, json=payload, headers=api.supervisor_headers
    )
    assert duplicate.status_code == 409


def test_override_validates_justification(api, authorization_payload) -> None:
    authorization_payload["requested_fuel"] = "DIESEL_S10"
    created = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    ).json()

    response = api.client.post(
        f"/api/v1/authorizations/{created['authorization_id']}/override",
        json={"supervisor_id": "supervisor-01", "justification": "curta"},
        headers=api.supervisor_headers,
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "justification",
    [
        "Veiculo ABC1D23 conferido manualmente pelo supervisor",
        "Identificador 12345678901 informado no atendimento",
        "CPF 123.456.789-00 confirmado manualmente",
        "Placa ABC.1D23 confirmada manualmente",
    ],
)
def test_override_rejects_vehicle_identifiers_in_free_text(
    api, authorization_payload, justification
) -> None:
    authorization_payload["plate"] = "TTT1T11"
    created = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    ).json()

    response = api.client.post(
        f"/api/v1/authorizations/{created['authorization_id']}/override",
        json={"supervisor_id": "supervisor-01", "justification": justification},
        headers=api.supervisor_headers,
    )

    assert response.status_code == 422
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id is None


def test_override_cannot_release_confirmed_incompatible_fuel(
    api, authorization_payload
) -> None:
    authorization_payload["plate"] = "AAA1A11"
    authorization_payload["requested_fuel"] = "DIESEL_S10"
    created = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    ).json()
    assert created["status"] == "DENIED"

    response = api.client.post(
        f"/api/v1/authorizations/{created['authorization_id']}/override",
        json={
            "supervisor_id": "supervisor-01",
            "justification": "Tentativa controlada que deve permanecer bloqueada",
        },
        headers=api.supervisor_headers,
    )

    assert response.status_code == 409


def test_override_cannot_reactivate_expired_authorization(
    api, authorization_payload
) -> None:
    created = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    ).json()
    api.clock.advance(seconds=31)
    expired = api.client.get(
        f"/api/v1/authorizations/{created['authorization_id']}"
    ).json()
    assert expired["status"] == "EXPIRED"

    response = api.client.post(
        f"/api/v1/authorizations/{created['authorization_id']}/override",
        json={
            "supervisor_id": "supervisor-01",
            "justification": "Autorizacao expirada exige uma nova consulta completa",
        },
        headers=api.supervisor_headers,
    )

    assert response.status_code == 409
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id is None


def test_review_required_expires_before_late_override(
    api, authorization_payload
) -> None:
    authorization_payload["plate"] = "TTT1T11"
    created = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    ).json()
    assert created["status"] == "REVIEW_REQUIRED"
    assert created["expires_at"] is not None
    api.clock.advance(seconds=31)

    response = api.client.post(
        f"/api/v1/authorizations/{created['authorization_id']}/override",
        json={
            "supervisor_id": "supervisor-01",
            "justification": "Revisao vencida deve exigir uma consulta veicular nova",
        },
        headers=api.supervisor_headers,
    )

    assert response.status_code == 409
    persisted = api.client.get(
        f"/api/v1/authorizations/{created['authorization_id']}"
    ).json()
    assert persisted["status"] == "EXPIRED"
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id is None


def test_old_review_cannot_interrupt_a_new_active_authorization(
    api, authorization_payload
) -> None:
    authorization_payload["plate"] = "TTT1T11"
    old_review = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    ).json()
    authorization_payload["plate"] = "AAA1A11"
    active = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    ).json()
    assert active["status"] == "AUTHORIZED"

    response = api.client.post(
        f"/api/v1/authorizations/{old_review['authorization_id']}/override",
        json={
            "supervisor_id": "supervisor-01",
            "justification": "Revisao antiga nao pode interromper autorizacao atual",
        },
        headers=api.supervisor_headers,
    )

    assert response.status_code == 409
    assert api.gateway.snapshot("pump-01").unlocked_nozzle_id == "nozzle-gasoline"


def test_unknown_authorization_returns_404(api) -> None:
    response = api.client.get("/api/v1/authorizations/does-not-exist")

    assert response.status_code == 404


def test_extra_request_fields_are_rejected(api, authorization_payload) -> None:
    authorization_payload["owner_name"] = "não deve ser aceito"

    response = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    )

    assert response.status_code == 422

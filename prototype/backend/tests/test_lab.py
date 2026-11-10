from __future__ import annotations


def test_lab_state_exposes_only_operational_device_data(api) -> None:
    response = api.client.get("/api/v1/lab/pumps/pump-01")

    assert response.status_code == 200
    body = response.json()
    assert body["gateway_mode"] == "simulated"
    assert body["transport"] == "in_memory"
    assert body["online"] is True
    assert body["unlocked_nozzle_id"] is None
    assert body["controls_enabled"] is True
    assert {item["gpio"] for item in body["nozzles"]} == {13, 14, 25, 26, 27}
    assert body["traces"][-1]["event"] == "DEVICE_ONLINE"
    assert "plate" not in response.text.lower()


def test_authorization_is_visible_as_command_and_ack(api, authorization_payload) -> None:
    created = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    )
    state = api.client.get("/api/v1/lab/pumps/pump-01")

    assert created.status_code == 201
    assert state.status_code == 200
    body = state.json()
    assert body["unlocked_nozzle_id"] == "nozzle-gasoline"
    command_events = [
        item for item in body["traces"] if item["event"] == "COMMAND_SENT"
    ]
    ack_events = [
        item for item in body["traces"] if item["event"] == "COMMAND_ACK"
    ]
    assert [item["command_type"] for item in command_events[-2:]] == [
        "LOCK_ALL",
        "UNLOCK",
    ]
    assert ack_events[-1]["result"] == "APPLIED"
    assert ack_events[-1]["nozzle_id"] == "nozzle-gasoline"


def test_connectivity_control_fails_closed_and_starts_new_session(
    api, authorization_payload
) -> None:
    api.client.post("/api/v1/authorizations", json=authorization_payload)
    before = api.client.get("/api/v1/lab/pumps/pump-01").json()

    offline = api.client.post(
        "/api/v1/lab/pumps/pump-01/connectivity", json={"online": False}
    )

    assert offline.status_code == 200
    assert offline.json()["online"] is False
    assert offline.json()["unlocked_nozzle_id"] is None
    assert offline.json()["traces"][-1]["event"] == "DEVICE_OFFLINE"

    online = api.client.post(
        "/api/v1/lab/pumps/pump-01/connectivity", json={"online": True}
    )
    assert online.status_code == 200
    assert online.json()["online"] is True
    assert online.json()["session_id"] != before["session_id"]


def test_emergency_stop_blocks_unlock_and_is_visible(api, authorization_payload) -> None:
    activated = api.client.post(
        "/api/v1/lab/pumps/pump-01/emergency-stop", json={"active": True}
    )
    decision = api.client.post(
        "/api/v1/authorizations", json=authorization_payload
    )

    assert activated.status_code == 200
    assert activated.json()["emergency_stop_active"] is True
    assert decision.status_code == 201
    assert decision.json()["status"] == "REVIEW_REQUIRED"
    assert decision.json()["reason_code"] == "DISPENSER_UNAVAILABLE"
    state = api.client.get("/api/v1/lab/pumps/pump-01").json()
    assert state["unlocked_nozzle_id"] is None
    assert any(
        trace["reason"] == "EMERGENCY_STOP_ACTIVE"
        for trace in state["traces"]
    )


def test_trace_clear_does_not_change_physical_state(api, authorization_payload) -> None:
    api.client.post("/api/v1/authorizations", json=authorization_payload)

    response = api.client.post("/api/v1/lab/pumps/pump-01/traces/clear")

    assert response.status_code == 200
    assert response.json()["traces"] == []
    assert response.json()["unlocked_nozzle_id"] == "nozzle-gasoline"

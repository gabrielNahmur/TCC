from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from paho.mqtt.packettypes import PacketTypes
from paho.mqtt.reasoncodes import ReasonCode

from app.domain import (
    DeviceCommand,
    DeviceCommandType,
    DispenserUnavailableError,
    Fuel,
)
from app.mqtt_dispenser import MqttDispenserGateway


class FakeMqttClient:
    def __init__(self) -> None:
        self.on_connect = None
        self.on_disconnect = None
        self.on_message = None
        self.published: list[tuple[str, dict[str, object], int, bool]] = []
        self.subscribed: list[tuple[str, int]] = []
        self.ack_override: dict[str, object] = {}

    def publish(self, topic, payload, qos, retain):
        command = json.loads(payload)
        self.published.append((topic, command, qos, retain))
        state = "UNLOCKED" if command["type"] == "UNLOCK" else "LOCKED"
        nozzle = command.get("nozzle_id", "NONE")
        ack = {
            "event": "COMMAND_ACK",
            "device_id": "esp32-bancada-01",
            "pump_id": "pump-01",
            "boot_id": "boot-session-01",
            "state": state,
            "nozzle_id": nozzle,
            "command_id": command["command_id"],
            "sequence": command["sequence"],
            "result": "APPLIED",
            **self.ack_override,
        }
        self.on_message(
            self,
            None,
            SimpleNamespace(payload=json.dumps(ack).encode("utf-8")),
        )
        return SimpleNamespace(rc=0)

    def subscribe(self, topic, qos):
        self.subscribed.append((topic, qos))
        return (0, 1)

    def disconnect(self):
        return 0

    def loop_stop(self):
        return None


def _gateway() -> tuple[MqttDispenserGateway, FakeMqttClient]:
    client = FakeMqttClient()
    gateway = MqttDispenserGateway(
        host="127.0.0.1",
        port=1883,
        topic_prefix="tcc/bancada",
        device_id="esp32-bancada-01",
        pump_id="pump-01",
        client=client,
        autostart=False,
        ack_timeout_seconds=0.1,
    )
    client.on_message(
        client,
        None,
        SimpleNamespace(
            payload=json.dumps(
                {
                    "event": "DEVICE_ONLINE",
                    "device_id": "esp32-bancada-01",
                    "pump_id": "pump-01",
                    "boot_id": "boot-session-01",
                    "last_sequence": 10,
                    "result": "LOCKED_ON_CONNECT",
                }
            ).encode("utf-8")
        ),
    )
    return gateway, client


def _publish_device_event(
    client: FakeMqttClient,
    event: str,
    *,
    boot_id: str = "boot-session-01",
    result: str = "APPLIED",
    reason: str | None = None,
) -> None:
    payload: dict[str, object] = {
        "event": event,
        "device_id": "esp32-bancada-01",
        "pump_id": "pump-01",
        "boot_id": boot_id,
        "state": "LOCKED",
        "nozzle_id": "NONE",
        "result": result,
    }
    if reason is not None:
        payload["reason"] = reason
    client.on_message(
        client,
        None,
        SimpleNamespace(payload=json.dumps(payload).encode("utf-8")),
    )


def _unlock(gateway: MqttDispenserGateway) -> DeviceCommand:
    now = datetime.now(UTC)
    return DeviceCommand(
        command_id="mqtt-command-01",
        type=DeviceCommandType.UNLOCK,
        pump_id="pump-01",
        issued_at=now,
        sequence=gateway.next_sequence_for("pump-01"),
        nozzle_id="nozzle-gasoline",
        expires_at=now + timedelta(seconds=30),
        session_id=gateway.session_id_for("pump-01"),
    )


def _lock_all(gateway: MqttDispenserGateway) -> DeviceCommand:
    return DeviceCommand(
        command_id="mqtt-lock-command-01",
        type=DeviceCommandType.LOCK_ALL,
        pump_id="pump-01",
        issued_at=datetime.now(UTC),
        sequence=gateway.next_sequence_for("pump-01"),
    )


def test_mqtt_gateway_subscribes_after_paho_connack() -> None:
    _, client = _gateway()

    client.on_connect(client, None, {}, ReasonCode(PacketTypes.CONNACK), None)

    assert client.subscribed == [("tcc/bancada/esp32-bancada-01/events", 1)]


def test_mqtt_gateway_publishes_non_retained_and_waits_for_coherent_ack() -> None:
    gateway, client = _gateway()

    gateway.apply(_unlock(gateway))

    topic, payload, qos, retained = client.published[-1]
    assert topic == "tcc/bancada/esp32-bancada-01/commands"
    assert payload["type"] == "UNLOCK"
    assert payload["session_id"] == "boot-session-01"
    assert payload["ttl_seconds"] == 30
    assert qos == 1
    assert retained is False
    snapshot = gateway.snapshot("pump-01")
    assert snapshot.transport == "mqtt"
    assert snapshot.unlocked_nozzle_id == "nozzle-gasoline"


def test_mqtt_gateway_rejects_ack_for_wrong_nozzle() -> None:
    gateway, client = _gateway()
    client.ack_override = {"nozzle_id": "nozzle-ethanol"}

    with pytest.raises(DispenserUnavailableError):
        gateway.apply(_unlock(gateway))

    assert gateway.snapshot("pump-01").unlocked_nozzle_id is None


def test_mqtt_gateway_accepts_duplicate_lock_all_as_safe_idempotency() -> None:
    gateway, client = _gateway()
    client.ack_override = {"result": "DUPLICATE"}

    gateway.apply(_lock_all(gateway))

    assert gateway.snapshot("pump-01").unlocked_nozzle_id is None


def test_mqtt_gateway_clears_local_unlock_after_rejected_ack() -> None:
    gateway, client = _gateway()
    gateway.apply(_unlock(gateway))
    assert gateway.snapshot("pump-01").unlocked_nozzle_id == "nozzle-gasoline"

    client.ack_override = {"result": "REJECTED", "reason": "TEST_REJECTION"}
    with pytest.raises(DispenserUnavailableError):
        gateway.apply(_lock_all(gateway))

    assert gateway.snapshot("pump-01").unlocked_nozzle_id is None


def test_mqtt_gateway_requires_current_device_session() -> None:
    gateway, _client = _gateway()
    command = _unlock(gateway)
    command = DeviceCommand(
        command_id=command.command_id,
        type=command.type,
        pump_id=command.pump_id,
        issued_at=command.issued_at,
        sequence=command.sequence,
        nozzle_id=command.nozzle_id,
        expires_at=command.expires_at,
        session_id="old-session",
    )

    with pytest.raises(DispenserUnavailableError):
        gateway.apply(command)


def test_mqtt_gateway_maps_all_five_nozzles() -> None:
    gateway, _client = _gateway()

    assert gateway.configured_nozzles("pump-01") == {
        Fuel.GASOLINE: "nozzle-gasoline",
        Fuel.ETHANOL: "nozzle-ethanol",
        Fuel.DIESEL_S10: "nozzle-diesel-s10",
        Fuel.DIESEL_S500: "nozzle-diesel-s500",
        Fuel.GNV: "nozzle-gnv",
    }


def test_mqtt_gateway_consumes_emergency_release_without_restoring_unlock() -> None:
    gateway, client = _gateway()
    gateway.apply(_unlock(gateway))

    _publish_device_event(
        client,
        "EMERGENCY_STOP",
        reason="PHYSICAL_INPUT_ACTIVE",
    )
    emergency_snapshot = gateway.snapshot("pump-01")
    assert emergency_snapshot.emergency_stop_active is True
    assert emergency_snapshot.unlocked_nozzle_id is None

    _publish_device_event(
        client,
        "EMERGENCY_STOP_RELEASED",
        result="READY",
        reason="PHYSICAL_INPUT_RELEASED",
    )

    released_snapshot = gateway.snapshot("pump-01")
    assert released_snapshot.emergency_stop_active is False
    assert released_snapshot.unlocked_nozzle_id is None
    assert released_snapshot.unlock_expires_at is None
    assert gateway.traces("pump-01")[-1].event == "EMERGENCY_STOP_RELEASED"
    assert gateway.traces("pump-01")[-1].result == "READY"


def test_mqtt_gateway_ignores_emergency_release_from_stale_session() -> None:
    gateway, client = _gateway()
    _publish_device_event(client, "EMERGENCY_STOP")
    assert gateway.snapshot("pump-01").emergency_stop_active is True

    _publish_device_event(
        client,
        "EMERGENCY_STOP_RELEASED",
        boot_id="previous-boot-session",
        result="READY",
    )

    snapshot = gateway.snapshot("pump-01")
    assert snapshot.emergency_stop_active is True
    assert all(
        trace.event != "EMERGENCY_STOP_RELEASED"
        for trace in gateway.traces("pump-01")
    )

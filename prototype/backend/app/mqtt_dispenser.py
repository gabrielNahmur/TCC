from __future__ import annotations

import json
from collections import deque
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Condition
from typing import Any
from uuid import uuid4

import paho.mqtt.client as mqtt
from paho.mqtt.reasoncodes import ReasonCode

from .dispenser import DispenserSnapshot, DispenserTrace
from .domain import (
    DeviceCommand,
    DeviceCommandType,
    DispenserUnavailableError,
    Fuel,
    UnknownPumpError,
)


@dataclass(slots=True)
class _PendingAck:
    command: DeviceCommand
    resolved: bool = False
    accepted: bool = False
    reason: str | None = None


class MqttDispenserGateway:
    """Adaptador síncrono que só confirma UNLOCK após um ACK MQTT coerente."""

    def __init__(
        self,
        *,
        host: str,
        port: int,
        topic_prefix: str,
        device_id: str,
        pump_id: str,
        username: str = "",
        password: str = "",
        use_tls: bool = False,
        ack_timeout_seconds: float = 3.0,
        client: Any | None = None,
        autostart: bool = True,
    ) -> None:
        self._host = host
        self._port = port
        self._device_id = device_id
        self._pump_id = pump_id
        self._command_topic = f"{topic_prefix}/{device_id}/commands"
        self._event_topic = f"{topic_prefix}/{device_id}/events"
        self._ack_timeout_seconds = ack_timeout_seconds
        self._catalog = {
            Fuel.GASOLINE: "nozzle-gasoline",
            Fuel.ETHANOL: "nozzle-ethanol",
            Fuel.DIESEL_S10: "nozzle-diesel-s10",
            Fuel.DIESEL_S500: "nozzle-diesel-s500",
            Fuel.GNV: "nozzle-gnv",
        }
        self._condition = Condition()
        self._online = False
        self._session_id = ""
        self._last_sequence = 0
        self._issued_sequence = 0
        self._unlocked_nozzle_id: str | None = None
        self._unlock_expires_at: datetime | None = None
        self._emergency_stop_active = False
        self._pending: dict[str, _PendingAck] = {}
        self._traces: deque[DispenserTrace] = deque(maxlen=100)

        self._client = client or mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"tcc-backend-{device_id}-{uuid4().hex[:8]}",
            protocol=mqtt.MQTTv311,
        )
        if username:
            self._client.username_pw_set(username, password)
        if use_tls:
            self._client.tls_set()
        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect
        self._client.on_message = self._on_message
        if autostart:
            self._client.connect_async(host, port, keepalive=15)
            self._client.loop_start()

    def nozzle_for(self, pump_id: str, fuel: Fuel) -> str | None:
        self._require_pump(pump_id)
        return self._catalog.get(fuel)

    def session_id_for(self, pump_id: str) -> str:
        self._require_pump(pump_id)
        with self._condition:
            if not self._online or not self._session_id:
                raise DispenserUnavailableError(pump_id)
            return self._session_id

    def next_sequence_for(self, pump_id: str) -> int:
        self._require_pump(pump_id)
        with self._condition:
            self._issued_sequence = max(
                self._issued_sequence, self._last_sequence
            ) + 1
            return self._issued_sequence

    def apply(self, command: DeviceCommand) -> None:
        self._require_pump(command.pump_id)
        with self._condition:
            if not self._online:
                raise DispenserUnavailableError(command.pump_id)
            if (
                command.type is DeviceCommandType.UNLOCK
                and command.session_id != self._session_id
            ):
                raise DispenserUnavailableError(command.pump_id)

            pending = _PendingAck(command=command)
            self._pending[command.command_id] = pending
            self._record(
                direction="BACKEND_TO_DEVICE",
                event="COMMAND_SENT",
                command=command,
                result="PUBLISHED",
            )

        payload: dict[str, object] = {
            "command_id": command.command_id,
            "sequence": command.sequence,
            "type": command.type.value,
            "pump_id": command.pump_id,
        }
        if command.type is DeviceCommandType.UNLOCK:
            payload.update(
                {
                    "nozzle_id": command.nozzle_id,
                    "ttl_seconds": command.ttl_seconds,
                    "session_id": command.session_id,
                }
            )

        info = self._client.publish(
            self._command_topic,
            json.dumps(payload, separators=(",", ":")),
            qos=1,
            retain=False,
        )
        if getattr(info, "rc", mqtt.MQTT_ERR_SUCCESS) != mqtt.MQTT_ERR_SUCCESS:
            with self._condition:
                self._pending.pop(command.command_id, None)
            raise DispenserUnavailableError(command.pump_id)

        with self._condition:
            resolved = self._condition.wait_for(
                lambda: pending.resolved,
                timeout=self._ack_timeout_seconds,
            )
            self._pending.pop(command.command_id, None)
            if not resolved:
                self._record(
                    direction="DEVICE_TO_BACKEND",
                    event="COMMAND_ACK_TIMEOUT",
                    command=command,
                    result="TIMEOUT",
                    reason="ACK_NOT_RECEIVED",
                )
                raise DispenserUnavailableError(command.pump_id)
            if not pending.accepted:
                raise DispenserUnavailableError(command.pump_id)

    def snapshot(self, pump_id: str) -> DispenserSnapshot:
        self._require_pump(pump_id)
        with self._condition:
            if (
                self._unlock_expires_at is not None
                and self._unlock_expires_at <= datetime.now(UTC)
            ):
                self._unlocked_nozzle_id = None
                self._unlock_expires_at = None
            return DispenserSnapshot(
                pump_id=pump_id,
                online=self._online,
                session_id=self._session_id,
                unlocked_nozzle_id=self._unlocked_nozzle_id,
                unlock_expires_at=self._unlock_expires_at,
                last_sequence=self._last_sequence,
                emergency_stop_active=self._emergency_stop_active,
                transport="mqtt",
            )

    def traces(self, pump_id: str) -> tuple[DispenserTrace, ...]:
        self._require_pump(pump_id)
        with self._condition:
            return tuple(self._traces)

    def configured_nozzles(self, pump_id: str) -> dict[Fuel, str]:
        self._require_pump(pump_id)
        return dict(self._catalog)

    def close(self) -> None:
        try:
            self._client.disconnect()
        finally:
            self._client.loop_stop()

    def _on_connect(
        self,
        client: Any,
        _userdata: Any,
        _flags: Any,
        reason_code: ReasonCode,
        _properties: Any = None,
    ) -> None:
        if reason_code == 0:
            client.subscribe(self._event_topic, qos=1)

    def _on_disconnect(
        self,
        _client: Any,
        _userdata: Any,
        _disconnect_flags: Any,
        _reason_code: Any,
        _properties: Any = None,
    ) -> None:
        with self._condition:
            self._online = False
            self._unlocked_nozzle_id = None
            self._unlock_expires_at = None
            self._record(
                direction="DEVICE_TO_BACKEND",
                event="BROKER_DISCONNECTED",
                result="LOCKED_ASSUMED",
                reason="MQTT_CONNECTION_LOST",
            )
            self._condition.notify_all()

    def _on_message(self, _client: Any, _userdata: Any, message: Any) -> None:
        try:
            payload = json.loads(bytes(message.payload).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError, TypeError):
            return
        if not isinstance(payload, dict):
            return
        if payload.get("device_id") != self._device_id:
            return
        if payload.get("pump_id") != self._pump_id:
            return

        event = payload.get("event")
        if not isinstance(event, str):
            return
        with self._condition:
            if event == "DEVICE_ONLINE":
                boot_id = payload.get("boot_id")
                if not isinstance(boot_id, str) or not boot_id:
                    return
                self._online = True
                self._session_id = boot_id
                self._emergency_stop_active = False
                self._unlocked_nozzle_id = None
                self._unlock_expires_at = None
                self._last_sequence = self._as_nonnegative_int(
                    payload.get("last_sequence")
                )
                self._issued_sequence = max(
                    self._issued_sequence, self._last_sequence
                )
                self._record(
                    direction="DEVICE_TO_BACKEND",
                    event=event,
                    result=str(payload.get("result") or "LOCKED_ON_CONNECT"),
                )
                self._condition.notify_all()
                return

            if event in {
                "DEVICE_OFFLINE",
                "FAIL_SAFE_LOCK",
                "TTL_EXPIRED",
                "EMERGENCY_STOP",
            }:
                self._unlocked_nozzle_id = None
                self._unlock_expires_at = None
                if event == "DEVICE_OFFLINE":
                    self._online = False
                if event == "EMERGENCY_STOP":
                    self._emergency_stop_active = True
                self._record(
                    direction="DEVICE_TO_BACKEND",
                    event=event,
                    result=self._optional_string(payload.get("result")),
                    reason=self._optional_string(payload.get("reason")),
                )
                self._condition.notify_all()
                return

            if event == "EMERGENCY_STOP_RELEASED":
                # Uma liberação atrasada de uma sessão anterior não pode
                # limpar a emergência observada na sessão atual. O evento
                # também nunca restaura a autorização anterior: após soltar o
                # botão, um novo comando UNLOCK continua sendo obrigatório.
                boot_id = self._optional_string(payload.get("boot_id"))
                if not self._online or boot_id != self._session_id:
                    return
                self._emergency_stop_active = False
                self._unlocked_nozzle_id = None
                self._unlock_expires_at = None
                self._record(
                    direction="DEVICE_TO_BACKEND",
                    event=event,
                    result=self._optional_string(payload.get("result")),
                    reason=self._optional_string(payload.get("reason")),
                )
                self._condition.notify_all()
                return

            if event != "COMMAND_ACK":
                return
            command_id = payload.get("command_id")
            if not isinstance(command_id, str):
                return
            pending = self._pending.get(command_id)
            if pending is None:
                return
            command = pending.command
            result = self._optional_string(payload.get("result")) or "REJECTED"
            sequence = self._as_nonnegative_int(payload.get("sequence"))
            boot_id = self._optional_string(payload.get("boot_id"))
            state = self._optional_string(payload.get("state"))
            nozzle_id = self._optional_string(payload.get("nozzle_id"))

            coherent = sequence == command.sequence and boot_id == self._session_id
            if command.type is DeviceCommandType.UNLOCK:
                coherent = (
                    coherent
                    and state == "UNLOCKED"
                    and nozzle_id == command.nozzle_id
                )
            else:
                coherent = coherent and state == "LOCKED"

            accepted_result = result == "APPLIED" or (
                command.type is DeviceCommandType.LOCK_ALL
                and result == "DUPLICATE"
            )
            pending.accepted = accepted_result and coherent
            pending.resolved = True
            pending.reason = (
                None
                if pending.accepted
                else self._optional_string(payload.get("reason"))
                or "ACK_INCOHERENT_OR_REJECTED"
            )
            if pending.accepted:
                self._last_sequence = command.sequence
                if command.type is DeviceCommandType.UNLOCK:
                    self._unlocked_nozzle_id = command.nozzle_id
                    self._unlock_expires_at = command.expires_at
                else:
                    self._unlocked_nozzle_id = None
                    self._unlock_expires_at = None
            else:
                # Um ACK rejeitado ou incoerente nunca pode manter a projeção
                # local de um bico liberado. O firmware também falha fechado.
                self._unlocked_nozzle_id = None
                self._unlock_expires_at = None
            self._record(
                direction="DEVICE_TO_BACKEND",
                event="COMMAND_ACK",
                command=command,
                result=result if coherent else "REJECTED",
                reason=pending.reason,
            )
            self._condition.notify_all()

    def _require_pump(self, pump_id: str) -> None:
        if pump_id != self._pump_id:
            raise UnknownPumpError(pump_id)

    @staticmethod
    def _as_nonnegative_int(value: object) -> int:
        if isinstance(value, bool):
            return 0
        if isinstance(value, int) and value >= 0:
            return value
        return 0

    @staticmethod
    def _optional_string(value: object) -> str | None:
        return value if isinstance(value, str) and value else None

    def _record(
        self,
        *,
        direction: str,
        event: str,
        command: DeviceCommand | None = None,
        result: str | None = None,
        reason: str | None = None,
    ) -> None:
        self._traces.append(
            DispenserTrace(
                event_id=str(uuid4()),
                timestamp=datetime.now(UTC),
                direction=direction,
                event=event,
                command_id=command.command_id if command else None,
                command_type=command.type.value if command else None,
                nozzle_id=command.nozzle_id if command else None,
                sequence=command.sequence if command else None,
                result=result,
                reason=reason,
            )
        )

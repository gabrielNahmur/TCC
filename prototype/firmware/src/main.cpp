#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <esp_system.h>
#include <cstdio>
#include <cstring>

#if __has_include("tcc_config.h")
#include "tcc_config.h"
#else
#include "tcc_config.defaults.h"
#endif

#if MQTT_USE_TLS
#include <WiFiClientSecure.h>
#endif

#include "interlock_logic.h"

namespace {

constexpr std::uint8_t kGasolinePin = 25;
constexpr std::uint8_t kEthanolPin = 26;
constexpr std::uint8_t kDieselS10Pin = 27;
constexpr std::uint8_t kDieselS500Pin = 13;
constexpr std::uint8_t kGnvPin = 14;
constexpr std::uint8_t kEmergencyStopPin = 33;
constexpr std::uint8_t kEmergencyStopActiveLevel = HIGH;
constexpr std::uint32_t kReconnectIntervalMs = 5000;
constexpr std::size_t kMaxPayloadBytes = 512;

#if MQTT_USE_TLS
WiFiClientSecure network_client;
#else
WiFiClient network_client;
#endif

PubSubClient mqtt(network_client);
Preferences preferences;
interlock::Controller controller;
interlock::EmergencyStopEdge emergency_stop_edge;

String command_topic;
String event_topic;
String boot_id;
std::uint32_t last_wifi_attempt_ms = 0;
std::uint32_t last_mqtt_attempt_ms = 0;

void deenergizeAllOutputs() {
  digitalWrite(kGasolinePin, LOW);
  digitalWrite(kEthanolPin, LOW);
  digitalWrite(kDieselS10Pin, LOW);
  digitalWrite(kDieselS500Pin, LOW);
  digitalWrite(kGnvPin, LOW);
}

void applyPhysicalState() {
  // Break-before-make: sempre desenergiza tudo antes de liberar uma saída.
  deenergizeAllOutputs();
  delayMicroseconds(500);
  if (!controller.state().unlocked) return;

  switch (controller.state().nozzle) {
    case interlock::Nozzle::GASOLINE: digitalWrite(kGasolinePin, HIGH); break;
    case interlock::Nozzle::ETHANOL: digitalWrite(kEthanolPin, HIGH); break;
    case interlock::Nozzle::DIESEL_S10: digitalWrite(kDieselS10Pin, HIGH); break;
    case interlock::Nozzle::DIESEL_S500: digitalWrite(kDieselS500Pin, HIGH); break;
    case interlock::Nozzle::GNV: digitalWrite(kGnvPin, HIGH); break;
    default: deenergizeAllOutputs(); break;
  }
}

String makeBootId() {
  char buffer[18];
  std::snprintf(buffer, sizeof(buffer), "%08lx%08lx",
                static_cast<unsigned long>(esp_random()),
                static_cast<unsigned long>(esp_random()));
  return String(buffer);
}

void publishEvent(const char* event,
                  const char* command_id = "",
                  const char* result = "",
                  const char* reason = "",
                  bool retained = false,
                  std::uint64_t sequence = 0) {
  if (!mqtt.connected()) return;
  JsonDocument document;
  document["event"] = event;
  document["device_id"] = DEVICE_ID;
  document["pump_id"] = PUMP_ID;
  document["boot_id"] = boot_id;
  document["state"] = controller.state().unlocked ? "UNLOCKED" : "LOCKED";
  document["nozzle_id"] = interlock::nozzleName(controller.state().nozzle);
  document["last_sequence"] = controller.lastSequence();
  if (sequence > 0) document["sequence"] = sequence;
  if (command_id[0] != '\0') document["command_id"] = command_id;
  if (result[0] != '\0') document["result"] = result;
  if (reason[0] != '\0') document["reason"] = reason;

  char payload[512];
  const std::size_t written = serializeJson(document, payload, sizeof(payload));
  if (written > 0 && written < sizeof(payload)) mqtt.publish(event_topic.c_str(), payload, retained);
}

void forceLock(const char* reason) {
  const bool state_changed = controller.state().unlocked;
  controller.forceLock();
  applyPhysicalState();
  if (state_changed) publishEvent("FAIL_SAFE_LOCK", "", "APPLIED", reason);
}

void persistCommand(const char* command_id, std::uint64_t sequence) {
  const std::uint8_t index = preferences.getUChar("write_idx", 0) % interlock::Controller::kHistorySize;
  const String key = "cmd" + String(index);
  preferences.putString(key.c_str(), command_id);
  preferences.putUChar("write_idx", static_cast<std::uint8_t>((index + 1U) % interlock::Controller::kHistorySize));
  preferences.putULong64("last_seq", sequence);
}

void loadCommandHistory() {
  controller.primeSequence(preferences.getULong64("last_seq", 0));
  for (std::size_t index = 0; index < interlock::Controller::kHistorySize; ++index) {
    const String key = "cmd" + String(index);
    const String value = preferences.getString(key.c_str(), "");
    if (!value.isEmpty()) controller.primeCommandId(value.c_str());
  }
}

void rejectAndLock(const char* command_id, const char* reason) {
  controller.forceLock();
  applyPhysicalState();
  publishEvent("COMMAND_ACK", command_id == nullptr ? "" : command_id, "REJECTED", reason);
}

void handleCommand(char* topic, byte* raw_payload, unsigned int length) {
  if (command_topic != topic) return;
  if (digitalRead(kEmergencyStopPin) == kEmergencyStopActiveLevel) {
    rejectAndLock("", "EMERGENCY_STOP_ACTIVE");
    return;
  }
  if (length == 0 || length > kMaxPayloadBytes) {
    rejectAndLock("", "INVALID_PAYLOAD_SIZE");
    return;
  }

  JsonDocument document;
  const DeserializationError error = deserializeJson(document, raw_payload, length);
  if (error) {
    rejectAndLock("", "INVALID_JSON");
    return;
  }

  const char* command_id = document["command_id"] | "";
  const char* type = document["type"] | "";
  const char* pump_id = document["pump_id"] | "";
  const std::uint64_t sequence = document["sequence"].as<std::uint64_t>();
  if (!interlock::Controller::validCommandId(command_id)) {
    rejectAndLock(command_id, "INVALID_COMMAND_ID");
    return;
  }
  if (std::strcmp(pump_id, PUMP_ID) != 0) {
    rejectAndLock(command_id, "PUMP_MISMATCH");
    return;
  }

  interlock::ApplyCode result = interlock::ApplyCode::REJECTED_INVALID_ID;
  if (std::strcmp(type, "LOCK_ALL") == 0) {
    result = controller.lockAll(command_id, sequence);
  } else if (std::strcmp(type, "UNLOCK") == 0) {
    const char* session_id = document["session_id"] | "";
    if (boot_id != session_id) {
      rejectAndLock(command_id, "SESSION_MISMATCH");
      return;
    }
    const char* nozzle_id = document["nozzle_id"] | "";
    const std::uint32_t ttl_seconds = document["ttl_seconds"] | 0U;
    result = controller.unlock(command_id, interlock::parseNozzle(nozzle_id), ttl_seconds, millis(), sequence);
  } else {
    rejectAndLock(command_id, "UNKNOWN_COMMAND");
    return;
  }

  applyPhysicalState();
  if (result == interlock::ApplyCode::APPLIED) persistCommand(command_id, sequence);
  publishEvent("COMMAND_ACK", command_id, interlock::applyCodeName(result), "", false, sequence);
}

bool hasNetworkConfiguration() {
  return std::strlen(WIFI_SSID) > 0 && std::strlen(MQTT_HOST) > 0;
}

void configureTls() {
#if MQTT_USE_TLS
  if (std::strlen(MQTT_CA_CERT) > 0) network_client.setCACert(MQTT_CA_CERT);
  if (std::strlen(MQTT_CLIENT_CERT) > 0) network_client.setCertificate(MQTT_CLIENT_CERT);
  if (std::strlen(MQTT_PRIVATE_KEY) > 0) network_client.setPrivateKey(MQTT_PRIVATE_KEY);
#endif
}

void ensureWiFi(std::uint32_t now_ms) {
  if (WiFi.status() == WL_CONNECTED || !hasNetworkConfiguration()) return;
  forceLock("WIFI_DISCONNECTED");
  if (now_ms - last_wifi_attempt_ms < kReconnectIntervalMs) return;
  last_wifi_attempt_ms = now_ms;
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void ensureMqtt(std::uint32_t now_ms) {
  if (WiFi.status() != WL_CONNECTED || mqtt.connected()) return;
  forceLock("MQTT_DISCONNECTED");
  if (now_ms - last_mqtt_attempt_ms < kReconnectIntervalMs) return;
  last_mqtt_attempt_ms = now_ms;

  const String client_id = String(DEVICE_ID) + "-" + boot_id.substring(0, 8);
  const String last_will = String("{\"event\":\"DEVICE_OFFLINE\",\"device_id\":\"") +
                           DEVICE_ID + "\",\"pump_id\":\"" + PUMP_ID +
                           "\",\"state\":\"UNKNOWN\"}";
  const bool connected = mqtt.connect(
      client_id.c_str(), MQTT_USERNAME, MQTT_PASSWORD,
      event_topic.c_str(), 1, true, last_will.c_str());
  if (!connected) return;

  controller.forceLock();
  applyPhysicalState();
  mqtt.subscribe(command_topic.c_str(), 1);
  publishEvent("DEVICE_ONLINE", "", "LOCKED_ON_CONNECT", "", true);
  if (digitalRead(kEmergencyStopPin) == kEmergencyStopActiveLevel) {
    forceLock("EMERGENCY_STOP_ACTIVE");
    publishEvent("EMERGENCY_STOP", "", "APPLIED", "PHYSICAL_INPUT_ACTIVE");
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  pinMode(kGasolinePin, OUTPUT);
  pinMode(kEthanolPin, OUTPUT);
  pinMode(kDieselS10Pin, OUTPUT);
  pinMode(kDieselS500Pin, OUTPUT);
  pinMode(kGnvPin, OUTPUT);
  pinMode(kEmergencyStopPin, INPUT_PULLUP);
  deenergizeAllOutputs();

  boot_id = makeBootId();
  command_topic = String(MQTT_TOPIC_PREFIX) + "/" + DEVICE_ID + "/commands";
  event_topic = String(MQTT_TOPIC_PREFIX) + "/" + DEVICE_ID + "/events";

  preferences.begin("interlock", false);
  loadCommandHistory();
  configureTls();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(handleCommand);
  mqtt.setBufferSize(768);
  mqtt.setKeepAlive(10);
  mqtt.setSocketTimeout(1);
  WiFi.mode(WIFI_STA);

  if (!hasNetworkConfiguration()) {
    Serial.println("Configuracao de rede ausente: todas as saidas permanecem bloqueadas.");
  }
}

void loop() {
  const std::uint32_t now_ms = millis();

  const bool emergency_stop_active =
      digitalRead(kEmergencyStopPin) == kEmergencyStopActiveLevel;
  const interlock::EmergencyStopTransition emergency_transition =
      emergency_stop_edge.update(emergency_stop_active);
  if (emergency_stop_active) {
    forceLock("EMERGENCY_STOP_ACTIVE");
    if (emergency_transition == interlock::EmergencyStopTransition::ACTIVATED) {
      publishEvent("EMERGENCY_STOP", "", "APPLIED", "PHYSICAL_INPUT_ACTIVE");
    }
  } else if (emergency_transition == interlock::EmergencyStopTransition::RELEASED) {
    // Soltar a emergência não religa nenhuma saída: o controlador segue
    // bloqueado até receber uma nova autorização UNLOCK válida.
    publishEvent("EMERGENCY_STOP_RELEASED", "", "READY", "PHYSICAL_INPUT_RELEASED");
  }

  if (WiFi.status() != WL_CONNECTED || !mqtt.connected()) {
    forceLock(WiFi.status() != WL_CONNECTED ? "WIFI_DISCONNECTED" : "MQTT_DISCONNECTED");
  }

  ensureWiFi(now_ms);
  ensureMqtt(now_ms);
  if (mqtt.connected()) mqtt.loop();

  if (controller.tick(now_ms)) {
    applyPhysicalState();
    publishEvent("TTL_EXPIRED", "", "APPLIED", "AUTHORIZATION_TTL_EXPIRED");
  }

  delay(5);
}

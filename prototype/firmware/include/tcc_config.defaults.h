#pragma once

// Valores seguros para permitir compilação sem segredos. Com campos vazios,
// o dispositivo permanece bloqueado e não tenta operar a bancada.
#define WIFI_SSID ""
#define WIFI_PASSWORD ""

#define MQTT_HOST ""
#define MQTT_PORT 1883
#define MQTT_USERNAME ""
#define MQTT_PASSWORD ""
#define MQTT_USE_TLS 0
#define MQTT_CA_CERT ""
#define MQTT_CLIENT_CERT ""
#define MQTT_PRIVATE_KEY ""

#define DEVICE_ID "esp32-bancada-01"
#define PUMP_ID "pump-01"
#define MQTT_TOPIC_PREFIX "tcc/bancada"

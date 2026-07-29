#pragma once

// Copie este arquivo para tcc_config.h. Nunca versione tcc_config.h.
#define WIFI_SSID "REDE_DE_BANCADA"
#define WIFI_PASSWORD "ALTERE_AQUI"

#define MQTT_HOST "192.0.2.10"
#define MQTT_PORT 8883
#define MQTT_USERNAME "esp32-bancada-01"
#define MQTT_PASSWORD "ALTERE_AQUI"
#define MQTT_USE_TLS 1

// Em C++, certificados PEM podem ser representados com literais raw:
// #define MQTT_CA_CERT R"EOF(-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----)EOF"
#define MQTT_CA_CERT ""
#define MQTT_CLIENT_CERT ""
#define MQTT_PRIVATE_KEY ""

#define DEVICE_ID "esp32-bancada-01"
#define PUMP_ID "pump-01"
#define MQTT_TOPIC_PREFIX "tcc/bancada"

#pragma once

// Configuração exclusivamente local para o QEMU do PICSimLab. Copie para
// tcc_config.h antes de gerar o workspace. Não use estes valores em rede real.
#define WIFI_SSID "PICSimLabWifi"
#define WIFI_PASSWORD ""

// O PICSimLab 0.9.2 inicia o QEMU com net=192.168.4.0/24. Na rede de usuário
// do QEMU, o segundo endereço da rede (192.168.4.2) representa o host.
#define MQTT_HOST "192.168.4.2"
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

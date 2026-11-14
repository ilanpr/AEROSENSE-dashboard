#pragma once
#include <atomic>
#include <esp_crt_bundle.h>
#include <mqtt_client.h>

namespace secureMqtt {
struct Command {
  unsigned int length;
  uint8_t data[1200];
};

static esp_mqtt_client_handle_t client;
static QueueHandle_t commands;
static std::atomic<bool> connected{false};
static const char* commandTopic;
static char offline[100];

inline void event(void*, esp_event_base_t, int32_t id, void* raw) {
  const auto e = static_cast<esp_mqtt_event_handle_t>(raw);
  if (id == MQTT_EVENT_CONNECTED) {
    esp_mqtt_client_subscribe(e->client, commandTopic, 1);
  } else if (id == MQTT_EVENT_SUBSCRIBED) {
    connected = true;
    Serial.println("WATERSENSE MQTT terhubung (WSS)");
  } else if (id == MQTT_EVENT_DISCONNECTED) {
    connected = false;
    xQueueReset(commands);
  } else if (id == MQTT_EVENT_ERROR) {
    Serial.printf("MQTT WSS belum terhubung: tipe=%d kode=%d\n",
      e->error_handle->error_type, e->error_handle->connect_return_code);
  } else if (id == MQTT_EVENT_DATA && e->current_data_offset == 0 &&
             e->data_len > 0 && e->data_len == e->total_data_len &&
             e->data_len <= sizeof(Command::data) &&
             e->topic_len == strlen(commandTopic) &&
             !memcmp(e->topic, commandTopic, e->topic_len)) {
    Command incoming;
    incoming.length = e->data_len;
    memcpy(incoming.data, e->data, incoming.length);
    xQueueSend(commands, &incoming, 0);
  }
}

inline bool start(const NetworkSettings& settings, const char* command, const char* status) {
  commands = xQueueCreate(6, sizeof(Command));
  if (!commands) return false;
  commandTopic = command;
  snprintf(offline, sizeof(offline), "{\"state\":\"offline\",\"actuator_id\":\"%s\"}", settings.id);
  esp_mqtt_client_config_t config{};
  config.broker.address.hostname = settings.broker;
  config.broker.address.transport = MQTT_TRANSPORT_OVER_WSS;
  config.broker.address.path = "/mqtt";
  config.broker.address.port = settings.port;
  config.broker.verification.crt_bundle_attach = esp_crt_bundle_attach;
  config.credentials.client_id = settings.id;
  config.credentials.username = settings.id;
  config.credentials.authentication.password = settings.mqttPassword;
  config.session.keepalive = 15;
  config.session.last_will.topic = status;
  config.session.last_will.msg = offline;
  config.session.last_will.qos = 1;
  config.session.last_will.retain = true;
  config.network.reconnect_timeout_ms = 5000;
  config.buffer.size = 1536;
  config.outbox.limit = 4096;
  client = esp_mqtt_client_init(&config);
  if (client && esp_mqtt_client_register_event(client, MQTT_EVENT_ANY, event, nullptr) == ESP_OK &&
      esp_mqtt_client_start(client) == ESP_OK) return true;
  if (client) esp_mqtt_client_destroy(client);
  client = nullptr;
  vQueueDelete(commands);
  commands = nullptr;
  return false;
}

inline void publish(const char* topic, const char* body) {
  if (connected) esp_mqtt_client_enqueue(client, topic, body, 0, 0, 1, true);
}
}

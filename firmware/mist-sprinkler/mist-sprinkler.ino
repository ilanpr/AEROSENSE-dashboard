// AEROSENSE mist sprinkler for ESP32 (Arduino core 3.x).
// Libraries: PubSubClient 2.8 (Nick O'Leary), ArduinoJson 7.
// Contract: docs/MIST-SPRINKLER.md. Topics:
//   aerosense/actuators/<ACTUATOR_ID>/command  (subscribe, QoS 1)
//   aerosense/actuators/<ACTUATOR_ID>/ack      (publish: accepted, rejected, completed, fault)
//   aerosense/actuators/<ACTUATOR_ID>/status   (publish retained, offline via Last Will)
#include <WiFi.h>
#include <PubSubClient.h>
#include <Preferences.h>
#include <time.h>
#include "config.h"
#include "mist_logic.h"

static const char* TOPIC_BASE = "aerosense/actuators/" ACTUATOR_ID;
static char commandTopic[96], ackTopic[96], statusTopic[96];

WiFiClient net;
PubSubClient mqtt(net);
Preferences prefs;
mist::State state{};

bool outputOn = false;
uint32_t pulseStartedMs = 0, pulseDurationMs = 0;
char activeCommand[mist::ID_LEN] = "";
uint32_t lastMqttAttempt = 0, lastWifiAttempt = 0, lastStatus = 0;

// Output first: called before anything else at boot and on every safety stop.
void setOutput(bool on) {
  outputOn = on;
  digitalWrite(RELAY_PIN, (on ^ RELAY_ACTIVE_LOW) ? HIGH : LOW);
#if STATUS_LED_PIN >= 0
  digitalWrite(STATUS_LED_PIN, on ? HIGH : LOW);
#endif
}

bool manualOff() {
#if MANUAL_OFF_PIN >= 0
  return digitalRead(MANUAL_OFF_PIN) == LOW;
#else
  return false;
#endif
}

bool waterOk() {
#if WATER_OK_PIN >= 0
  return digitalRead(WATER_OK_PIN) == WATER_OK_LEVEL;
#else
  return true;
#endif
}

int64_t nowEpoch() { return static_cast<int64_t>(time(nullptr)); }

void saveState() { prefs.putBytes("state", &state, sizeof(state)); }

void loadState() {
  if (prefs.getBytesLength("state") == sizeof(state)) prefs.getBytes("state", &state, sizeof(state));
  else memset(&state, 0, sizeof(state));
  if (state.next >= mist::RECENT_IDS) state.next = 0;
}

void isoNow(char* out, size_t size) {
  time_t t = time(nullptr);
  struct tm utc;
  gmtime_r(&t, &utc);
  strftime(out, size, "%Y-%m-%dT%H:%M:%SZ", &utc);
}

void publishAck(const char* commandId, const char* ackState, const char* reason, uint32_t durationMs = 0) {
  if (!mqtt.connected()) return;
  char at[24], body[320];
  isoNow(at, sizeof(at));
  snprintf(body, sizeof(body),
           "{\"command_id\":\"%s\",\"actuator_id\":\"%s\",\"state\":\"%s\",\"reason\":\"%s\",\"duration_ms\":%lu,\"at\":\"%s\"}",
           commandId, ACTUATOR_ID, ackState, reason, static_cast<unsigned long>(durationMs), at);
  mqtt.publish(ackTopic, body, false);
}

void publishStatus() {
  if (!mqtt.connected()) return;
  char at[24], body[300];
  isoNow(at, sizeof(at));
  snprintf(body, sizeof(body),
           "{\"state\":\"online\",\"actuator_id\":\"%s\",\"output\":\"%s\",\"manual_off\":%s,\"water_ok\":%s,\"clock_synced\":%s,\"rssi\":%d,\"uptime_s\":%lu,\"at\":\"%s\"}",
           ACTUATOR_ID, outputOn ? "on" : "off", manualOff() ? "true" : "false", waterOk() ? "true" : "false",
           nowEpoch() >= mist::SYNCED_AFTER ? "true" : "false", WiFi.RSSI(), static_cast<unsigned long>(millis() / 1000), at);
  mqtt.publish(statusTopic, body, true);
}

void stopPulse(const char* ackState, const char* reason) {
  if (!outputOn) return;
  setOutput(false);
  publishAck(activeCommand, ackState, reason, millis() - pulseStartedMs);
  activeCommand[0] = '\0';
  publishStatus();
}

void onMessage(char* topic, byte* payload, unsigned int length) {
  if (strcmp(topic, commandTopic) != 0) return;
  mist::Inputs in{ACTUATOR_ID, nowEpoch(), outputOn, manualOff(), waterOk()};
  mist::Decision d = mist::evaluate(reinterpret_cast<const char*>(payload), length, in, state);
  const bool ours = d.commandId[0] && strcmp(d.reason, "wrong_actuator") != 0;
  if (!d.accept) {
    if (ours && strcmp(d.reason, "duplicate") != 0) { mist::rememberId(state, d.commandId); saveState(); }
    publishAck(d.commandId[0] ? d.commandId : "unknown", "rejected", d.reason);
    return;
  }
  // Persist before switching on, so a reboot during the pulse can neither repeat it nor skip the cooldown.
  mist::rememberId(state, d.commandId);
  mist::rememberPulse(state, d, in.now);
  saveState();
  strncpy(activeCommand, d.commandId, sizeof(activeCommand) - 1);
  pulseDurationMs = d.durationMs;
  pulseStartedMs = millis();
  setOutput(true);
  publishAck(d.commandId, "accepted", d.status, d.durationMs);
  publishStatus();
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - lastWifiAttempt < 10000 && lastWifiAttempt) return;
  lastWifiAttempt = millis();
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void ensureMqtt() {
  if (WiFi.status() != WL_CONNECTED || mqtt.connected()) return;
  if (millis() - lastMqttAttempt < 5000 && lastMqttAttempt) return;
  lastMqttAttempt = millis();
  const char* offline = "{\"state\":\"offline\",\"actuator_id\":\"" ACTUATOR_ID "\"}";
  if (mqtt.connect(ACTUATOR_ID, ACTUATOR_ID, MQTT_PASSWORD, statusTopic, 1, true, offline, true)) {
    mqtt.subscribe(commandTopic, 1);
    publishStatus();
    Serial.println("MQTT terhubung");
  } else {
    Serial.printf("MQTT gagal, state %d\n", mqtt.state());
  }
}

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
#if STATUS_LED_PIN >= 0
  pinMode(STATUS_LED_PIN, OUTPUT);
#endif
  setOutput(false);  // before networking, every boot
#if MANUAL_OFF_PIN >= 0
  pinMode(MANUAL_OFF_PIN, INPUT_PULLUP);
#endif
#if WATER_OK_PIN >= 0
  pinMode(WATER_OK_PIN, INPUT_PULLUP);
#endif
  Serial.begin(115200);
  snprintf(commandTopic, sizeof(commandTopic), "%s/command", TOPIC_BASE);
  snprintf(ackTopic, sizeof(ackTopic), "%s/ack", TOPIC_BASE);
  snprintf(statusTopic, sizeof(statusTopic), "%s/status", TOPIC_BASE);
  prefs.begin("aerosense-mist", false);
  loadState();
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(1024);
  mqtt.setKeepAlive(15);
  mqtt.setCallback(onMessage);
  ensureWifi();
}

void loop() {
  // Safety first, every pass: the timer ends the pulse locally, without waiting for n8n.
  if (outputOn) {
    if (millis() - pulseStartedMs >= pulseDurationMs || millis() - pulseStartedMs >= mist::MAX_PULSE_MS) stopPulse("completed", "timer");
    else if (manualOff()) stopPulse("fault", "manual_off");
    else if (!waterOk()) stopPulse("fault", "water_low");
    else if (WiFi.status() != WL_CONNECTED || !mqtt.connected()) { setOutput(false); activeCommand[0] = '\0'; }
  }
  ensureWifi();
  ensureMqtt();
  mqtt.loop();
  if (millis() - lastStatus > 60000) { lastStatus = millis(); publishStatus(); }
  delay(5);
}

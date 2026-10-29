#include "WiFi.h"
#include "PubSubClient.h"
#include "Preferences.h"
uint32_t g_millis = 0; long g_epoch = 1792224000; int g_pins[64] = {0}; bool g_wifi = true, g_broker = true;
SerialT Serial; WiFiT WiFi; std::vector<Pub> g_pubs; std::vector<uint8_t> g_nvs;
#include "time_shim.h"
#include "../mist-sprinkler.ino"
#include <cassert>
#include <iostream>
static std::string iso(long t) { char b[32]; time_t x = t; struct tm u; gmtime_r(&x, &u); strftime(b, sizeof b, "%Y-%m-%dT%H:%M:%S.000Z", &u); return b; }
static std::string cmd(const std::string& id, int dur = 3000, long issued = 0, long ttl = 30, const char* act = "mist-01", const char* status = "warning") {
  if (!issued) issued = g_epoch;
  return "{\"version\":1,\"command_id\":\"" + id + "\",\"actuator_id\":\"" + act + "\",\"node_id\":\"node-01\",\"reading_id\":\"r1\",\"metric\":\"dust_ug_m3\",\"status\":\"" + status +
    "\",\"action\":\"pulse\",\"duration_ms\":" + std::to_string(dur) + ",\"cooldown_ms\":600000,\"issued_at\":\"" + iso(issued) + "\",\"expires_at\":\"" + iso(issued + ttl) + "\"}";
}
static std::string lastAck() { for (auto it = g_pubs.rbegin(); it != g_pubs.rend(); ++it) if (it->topic.find("/ack") != std::string::npos) return it->body; return ""; }
static void run(uint32_t ms) { uint32_t end = g_millis + ms; while (g_millis < end) loop(); }
static bool relayOn() { return g_pins[RELAY_PIN] == (RELAY_ACTIVE_LOW ? LOW : HIGH); }
static void send(const std::string& body) { mqtt.inject(commandTopic, body); }
static int checks = 0;
#define CHECK(c, msg) do { checks++; if (!(c)) { std::cerr << "FAIL: " << msg << "\n  ack=" << lastAck() << "\n"; return 1; } } while (0)
int main() {
  g_pins[MANUAL_OFF_PIN] = HIGH; g_pins[WATER_OK_PIN] = WATER_OK_LEVEL;
  setup();
  CHECK(!relayOn(), "output off at boot");
  run(100);
  CHECK(mqtt.sub == "aerosense/actuators/mist-01/command", "subscribed to own command topic");
  send(cmd("mist:mist-01:r1", 3000));
  CHECK(relayOn() && lastAck().find("\"accepted\"") != std::string::npos, "valid command starts pulse");
  send(cmd("mist:mist-01:r1", 3000));
  CHECK(lastAck().find("duplicate") != std::string::npos, "duplicate rejected");
  send(cmd("mist:mist-01:r2", 3000));
  CHECK(lastAck().find("pulse_active") != std::string::npos, "second command during pulse rejected, timer not extended");
  run(3100);
  CHECK(!relayOn() && lastAck().find("completed") != std::string::npos, "local timer switches off without OFF message");
  g_epoch += 120;
  send(cmd("mist:mist-01:r3", 3000));
  CHECK(!relayOn() && lastAck().find("cooldown") != std::string::npos, "cooldown enforced locally");
  g_epoch += 600;
  send(cmd("mist:mist-01:r4", 20000));
  CHECK(!relayOn() && lastAck().find("invalid_duration") != std::string::npos, "duration above 10 s rejected");
  send(cmd("mist:mist-01:r5", 3000, g_epoch - 40));
  CHECK(!relayOn() && lastAck().find("expired") != std::string::npos, "expired command rejected");
  send(cmd("mist:mist-01:r6", 3000, 0, 30, "mist-02"));
  CHECK(!relayOn() && lastAck().find("wrong_actuator") != std::string::npos, "other actuator id rejected");
  send("{not json");
  CHECK(!relayOn() && lastAck().find("invalid_json") != std::string::npos, "malformed payload rejected");
  g_pins[WATER_OK_PIN] = !WATER_OK_LEVEL;
  send(cmd("mist:mist-01:r7", 3000));
  CHECK(!relayOn() && lastAck().find("water_low") != std::string::npos, "water interlock blocks pulse");
  g_pins[WATER_OK_PIN] = WATER_OK_LEVEL;
  send(cmd("mist:mist-01:r7", 3000));
  CHECK(!relayOn() && lastAck().find("duplicate") != std::string::npos, "command seen while blocked is not replayed later");
  send(cmd("mist:mist-01:r8", 5000, 0, 30, "mist-01", "danger"));
  CHECK(relayOn(), "danger pulse starts");
  g_pins[MANUAL_OFF_PIN] = LOW; run(20);
  CHECK(!relayOn() && lastAck().find("manual_off") != std::string::npos, "manual OFF switch stops pulse");
  g_pins[MANUAL_OFF_PIN] = HIGH;
  g_epoch += 700;
  send(cmd("mist:mist-01:r9", 5000));
  CHECK(relayOn(), "pulse after cooldown");
  g_broker = false; run(20);
  CHECK(!relayOn(), "broker loss switches output off");
  // Reboot: state persisted in NVS, output off, no pulse replayed, cooldown kept.
  g_broker = true; g_millis += 1000;
  memset(&state, 0, sizeof(state)); outputOn = false; lastMqttAttempt = 0; lastWifiAttempt = 0; mqtt.conn = false;
  setup(); run(100);
  CHECK(!relayOn(), "output off after reboot");
  send(cmd("mist:mist-01:r9", 5000));
  CHECK(!relayOn() && lastAck().find("duplicate") != std::string::npos, "redelivered command after reboot rejected");
  send(cmd("mist:mist-01:r10", 5000));
  CHECK(!relayOn() && lastAck().find("cooldown") != std::string::npos, "cooldown survives reboot");
  long realEpoch = g_epoch; g_epoch = 100;
  send(cmd("mist:mist-01:r11", 3000, realEpoch));
  CHECK(!relayOn() && lastAck().find("clock_not_synced") != std::string::npos, "unsynced clock rejected");
  bool statusRetained = false; for (auto& p : g_pubs) if (p.topic.find("/status") != std::string::npos && p.retained) statusRetained = true;
  CHECK(statusRetained, "status published retained");
  std::cout << "all " << checks << " checks passed\n";
}

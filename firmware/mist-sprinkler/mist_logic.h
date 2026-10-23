// Command validation for the AEROSENSE mist sprinkler. Pure C++ (no Arduino calls)
// so the rules can be unit tested on a computer. See docs/MIST-SPRINKLER.md.
#pragma once
#include <ArduinoJson.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

namespace mist {

constexpr uint32_t MIN_PULSE_MS = 1000;
constexpr uint32_t MAX_PULSE_MS = 10000;      // hard cap, payload cannot exceed it
constexpr int64_t MIN_COOLDOWN_S = 600;        // local minimum, payload can only lengthen it
constexpr int64_t MAX_COOLDOWN_S = 86400;
constexpr int64_t MAX_LIFETIME_S = 60;         // expires_at - issued_at
constexpr int64_t CLOCK_SKEW_S = 5;
constexpr int64_t SYNCED_AFTER = 1735689600;   // 2025-01-01: earlier clock means NTP not synced
constexpr size_t RECENT_IDS = 8;
constexpr size_t ID_LEN = 96;

struct State {
  char recent[RECENT_IDS][ID_LEN];
  uint8_t next;
  int64_t lastPulseEpoch;
  int64_t cooldownS;
};

struct Inputs {
  const char* actuatorId;
  int64_t now;          // Unix seconds from NTP
  bool pulseActive;
  bool manualOff;       // physical OFF switch engaged
  bool waterOk;         // water/float interlock
};

struct Decision {
  bool accept;
  const char* reason;
  char commandId[ID_LEN];
  char status[12];
  uint32_t durationMs;
  int64_t cooldownS;
};

inline int64_t daysFromCivil(int64_t y, unsigned m, unsigned d) {
  y -= m <= 2;
  const int64_t era = (y >= 0 ? y : y - 399) / 400;
  const unsigned yoe = static_cast<unsigned>(y - era * 400);
  const unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return era * 146097 + static_cast<int64_t>(doe) - 719468;
}

// Parses "YYYY-MM-DDTHH:MM:SS[.fff]Z" (the format n8n sends) to Unix seconds.
inline bool parseIsoUtc(const char* s, int64_t& out) {
  if (!s) return false;
  int y, mo, d, h, mi, se;
  int used = 0;
  if (sscanf(s, "%4d-%2d-%2dT%2d:%2d:%2d%n", &y, &mo, &d, &h, &mi, &se, &used) != 6 || used != 19) return false;
  const char* rest = s + used;
  if (*rest == '.') { rest++; int digits = 0; while (*rest >= '0' && *rest <= '9') { rest++; digits++; } if (!digits) return false; }
  if (rest[0] != 'Z' || rest[1] != '\0') return false;
  if (y < 2020 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || se > 60) return false;
  out = daysFromCivil(y, mo, d) * 86400 + h * 3600 + mi * 60 + se;
  return true;
}

inline bool seen(const State& st, const char* id) {
  for (size_t i = 0; i < RECENT_IDS; i++) if (st.recent[i][0] && strncmp(st.recent[i], id, ID_LEN) == 0) return true;
  return false;
}

inline Decision reject(Decision d, const char* reason) { d.accept = false; d.reason = reason; return d; }

inline Decision evaluate(const char* payload, size_t length, const Inputs& in, const State& st) {
  Decision d{};
  d.accept = false;
  d.reason = "invalid_json";
  JsonDocument doc;
  if (deserializeJson(doc, payload, length) || !doc.is<JsonObject>()) return d;

  const char* id = doc["command_id"].is<const char*>() ? doc["command_id"].as<const char*>() : nullptr;
  if (!id || !*id || strlen(id) >= ID_LEN) return reject(d, "invalid_command_id");
  strncpy(d.commandId, id, ID_LEN - 1);

  if (!doc["version"].is<int>() || doc["version"].as<int>() != 1) return reject(d, "unsupported_version");
  const char* actuator = doc["actuator_id"].is<const char*>() ? doc["actuator_id"].as<const char*>() : "";
  if (strcmp(actuator, in.actuatorId) != 0) return reject(d, "wrong_actuator");
  const char* action = doc["action"].is<const char*>() ? doc["action"].as<const char*>() : "";
  if (strcmp(action, "pulse") != 0) return reject(d, "unsupported_action");
  if (seen(st, id)) return reject(d, "duplicate");

  if (in.manualOff) return reject(d, "manual_off");
  if (!in.waterOk) return reject(d, "water_low");
  if (in.now < SYNCED_AFTER) return reject(d, "clock_not_synced");

  int64_t issued = 0, expires = 0;
  if (!parseIsoUtc(doc["issued_at"].as<const char*>(), issued) || !parseIsoUtc(doc["expires_at"].as<const char*>(), expires))
    return reject(d, "invalid_time");
  if (expires <= issued || expires - issued > MAX_LIFETIME_S) return reject(d, "invalid_lifetime");
  if (issued > in.now + CLOCK_SKEW_S) return reject(d, "issued_in_future");
  if (in.now >= expires) return reject(d, "expired");

  const char* status = doc["status"].is<const char*>() ? doc["status"].as<const char*>() : "";
  if (strcmp(status, "warning") != 0 && strcmp(status, "danger") != 0) return reject(d, "invalid_status");
  strncpy(d.status, status, sizeof(d.status) - 1);

  if (!doc["duration_ms"].is<uint32_t>()) return reject(d, "invalid_duration");
  const uint32_t duration = doc["duration_ms"].as<uint32_t>();
  if (duration < MIN_PULSE_MS || duration > MAX_PULSE_MS) return reject(d, "invalid_duration");

  if (in.pulseActive) return reject(d, "pulse_active");
  if (st.lastPulseEpoch > 0 && in.now - st.lastPulseEpoch < (st.cooldownS > MIN_COOLDOWN_S ? st.cooldownS : MIN_COOLDOWN_S))
    return reject(d, "cooldown");

  int64_t cooldown = doc["cooldown_ms"].is<uint32_t>() ? doc["cooldown_ms"].as<uint32_t>() / 1000 : 0;
  if (cooldown < MIN_COOLDOWN_S) cooldown = MIN_COOLDOWN_S;
  if (cooldown > MAX_COOLDOWN_S) cooldown = MAX_COOLDOWN_S;

  d.accept = true;
  d.reason = "accepted";
  d.durationMs = duration;
  d.cooldownS = cooldown;
  return d;
}

// Remember every evaluated command id (accepted or not) so redelivery cannot start a pulse.
inline void rememberId(State& st, const char* id) {
  if (!id || !*id || seen(st, id)) return;
  strncpy(st.recent[st.next], id, ID_LEN - 1);
  st.recent[st.next][ID_LEN - 1] = '\0';
  st.next = static_cast<uint8_t>((st.next + 1) % RECENT_IDS);
}

inline void rememberPulse(State& st, const Decision& d, int64_t now) {
  st.lastPulseEpoch = now;
  st.cooldownS = d.cooldownS;
}

}  // namespace mist

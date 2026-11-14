#pragma once
#include "espnow_link.h"

namespace offline {
inline bool sameNode(const char* a, const char* b) {
  while (*a && *b) {
    const char x = *a == '_' ? '-' : tolower(static_cast<unsigned char>(*a));
    const char y = *b == '_' ? '-' : tolower(static_cast<unsigned char>(*b));
    if (x != y) return false;
    ++a;
    ++b;
  }
  return *a == *b;
}

struct Policy {
  char actuator[41], node[41], revision[17];
  bool local, enabled;
  float warning, danger;
  uint32_t duration, cooldown;
};

inline bool parse(JsonObjectConst doc, Policy& out) {
  const char* actuator = doc["actuator_id"] | "";
  const char* node = doc["node_id"] | "";
  const char* revision = doc["revision"] | "";
  if (!*actuator || strlen(actuator) >= sizeof(out.actuator) ||
      !*node || strlen(node) >= sizeof(out.node) ||
      strlen(revision) != 16 || strspn(revision, "0123456789abcdef") != 16 ||
      !doc["local"].is<bool>() || !doc["enabled"].is<bool>()) return false;
  const bool enabled = doc["enabled"].as<bool>();
  const bool local = doc["local"].as<bool>();
  const float warning = doc["warning"] | -1.0f, danger = doc["danger"] | -1.0f;
  const uint32_t duration = doc["duration_ms"] | 0UL, cooldown = doc["cooldown_ms"] | 0UL;
  if (enabled && (!local || !isfinite(warning) || !isfinite(danger) ||
      warning < 0 || danger <= warning || danger > 1000000 ||
      !mist::sessionDurationAllowed(duration) || cooldown < 600000 || cooldown > 86400000)) return false;
  strlcpy(out.actuator, actuator, sizeof(out.actuator));
  strlcpy(out.node, node, sizeof(out.node));
  strlcpy(out.revision, revision, sizeof(out.revision));
  out.local = local;
  out.enabled = enabled;
  out.warning = warning;
  out.danger = danger;
  out.duration = duration;
  out.cooldown = cooldown;
  return true;
}
}

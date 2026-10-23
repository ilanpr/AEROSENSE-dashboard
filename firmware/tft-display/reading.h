// Parses /v1/public/nodes?node_id=... into what the screen shows. No Arduino calls,
// so it can be tested on a computer.
#pragma once
#include <ArduinoJson.h>
#include <math.h>
#include <string.h>

enum class Level { Unknown, Good, Warning, Danger };

struct Reading {
  bool ok = false;
  char error[48] = "";
  char name[40] = "";
  char observedAt[32] = "";   // ISO time from the API
  bool stale = false;
  bool invalid = false;
  bool pm25 = false;          // true when the node has validated PM2.5
  float particle = NAN, eco2 = NAN, tvoc = NAN, temperature = NAN, humidity = NAN;
  float high = NAN, dangerHigh = NAN;
  Level level = Level::Unknown;
};

inline float metric(JsonVariantConst metrics, const char* key) {
  JsonVariantConst v = metrics[key];
  return v.is<float>() ? v.as<float>() : NAN;
}

inline Reading parseReading(const char* json, size_t length) {
  Reading r;
  JsonDocument filter;
  filter["nodes"][0]["name"] = true;
  filter["nodes"][0]["pm25_validated"] = true;
  filter["nodes"][0]["rules"] = true;
  filter["nodes"][0]["latest"] = true;
  JsonDocument doc;
  if (deserializeJson(doc, json, length, DeserializationOption::Filter(filter))) { strcpy(r.error, "Respons server tidak terbaca"); return r; }
  JsonVariantConst node = doc["nodes"][0];
  if (node.isNull()) { strcpy(r.error, "Node belum dipublikasikan"); return r; }
  strncpy(r.name, node["name"] | "Node AEROSENSE", sizeof(r.name) - 1);
  JsonVariantConst latest = node["latest"];
  if (latest.isNull() || latest["reading_id"].isNull()) { strcpy(r.error, "Belum ada pembacaan"); return r; }
  r.pm25 = node["pm25_validated"] | false;
  r.stale = latest["stale"] | false;
  r.invalid = latest["quality"]["invalid"] | false;
  strncpy(r.observedAt, latest["observed_at"] | "", sizeof(r.observedAt) - 1);
  JsonVariantConst m = latest["metrics"];
  const char* particleKey = r.pm25 ? "pm25_ug_m3" : "dust_ug_m3";
  r.particle = metric(m, particleKey);
  r.eco2 = metric(m, "eco2_ppm");
  r.tvoc = metric(m, "tvoc_ppb");
  r.temperature = metric(m, "temperature_c");
  r.humidity = metric(m, "humidity_pct");
  for (JsonVariantConst rule : node["rules"].as<JsonArrayConst>()) {
    if (strcmp(rule["metric"] | "", particleKey) != 0 || !(rule["enabled"] | false)) continue;
    if (rule["high"].is<float>()) r.high = rule["high"].as<float>();
    if (rule["danger_high"].is<float>()) r.dangerHigh = rule["danger_high"].as<float>();
  }
  if (!isnan(r.particle) && !r.invalid) {
    if (!isnan(r.dangerHigh) && r.particle >= r.dangerHigh) r.level = Level::Danger;
    else if (!isnan(r.high) && r.particle >= r.high) r.level = Level::Warning;
    else if (!isnan(r.high)) r.level = Level::Good;
  }
  r.ok = true;
  return r;
}

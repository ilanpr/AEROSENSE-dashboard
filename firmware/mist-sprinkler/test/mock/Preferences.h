#pragma once
#include "WiFi.h"
extern std::vector<uint8_t> g_nvs;
struct Preferences {
  void begin(const char*, bool) {}
  size_t putBytes(const char*, const void* d, size_t n) { g_nvs.assign((const uint8_t*)d, (const uint8_t*)d + n); return n; }
  size_t getBytesLength(const char*) { return g_nvs.size(); }
  size_t getBytes(const char*, void* d, size_t n) { memcpy(d, g_nvs.data(), n); return n; }
};

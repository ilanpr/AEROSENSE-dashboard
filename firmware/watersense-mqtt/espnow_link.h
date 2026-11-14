#pragma once
#include <WiFi.h>
#include <Preferences.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_random.h>
#include <mbedtls/md.h>
#include <stddef.h>

namespace localLink {
struct Pair { uint8_t mac[6], key[16], channel; };
struct Reading { uint32_t magic, boot, sequence; float dust; char node[41]; uint8_t auth[16]; };
constexpr uint32_t MAGIC = 0x41455231;
constexpr uint32_t FRESH_MS = 12000;

inline bool load(Preferences& prefs, Pair& pair) {
  return prefs.getBytesLength("esp-pair") == sizeof(pair) &&
    prefs.getBytes("esp-pair", &pair, sizeof(pair)) == sizeof(pair) &&
    pair.channel >= 1 && pair.channel <= 13;
}

inline bool digest(const Pair& pair, const void* data, size_t size, uint8_t (&hash)[32]) {
  return mbedtls_md_hmac(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), pair.key, sizeof(pair.key),
    static_cast<const uint8_t*>(data), size, hash) == 0;
}

inline bool sign(const Pair& pair, Reading& reading) {
  uint8_t hash[32];
  if (!digest(pair, &reading, offsetof(Reading, auth), hash)) return false;
  memcpy(reading.auth, hash, sizeof(reading.auth));
  return true;
}

inline bool verify(const Pair& pair, const Reading& reading) {
  uint8_t hash[32];
  if (!digest(pair, &reading, offsetof(Reading, auth), hash)) return false;
  uint8_t difference = 0;
  for (size_t i = 0; i < sizeof(reading.auth); ++i) difference |= hash[i] ^ reading.auth[i];
  return difference == 0;
}

inline bool add(const Pair& pair) {
  esp_now_peer_info_t peer{};
  uint8_t hash[32];
  if (!digest(pair, "AEROSENSE-PMK", 13, hash) || esp_now_set_pmk(hash) != ESP_OK ||
      !digest(pair, "AEROSENSE-LMK", 13, hash)) return false;
  memcpy(peer.peer_addr, pair.mac, sizeof(peer.peer_addr));
  memcpy(peer.lmk, hash, sizeof(peer.lmk));
  peer.ifidx = WIFI_IF_STA;
  peer.encrypt = true;
  return esp_now_add_peer(&peer) == ESP_OK;
}

inline int hex(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

inline bool decode(const char* text, uint8_t* bytes, size_t count) {
  if (strlen(text) != count * 2) return false;
  for (size_t i = 0; i < count; ++i) {
    int a = hex(text[i * 2]), b = hex(text[i * 2 + 1]);
    if (a < 0 || b < 0) return false;
    bytes[i] = (a << 4) | b;
  }
  return true;
}

inline void console(Preferences& prefs, void (*extra)(const char*) = nullptr) {
  static char line[600];
  static size_t used = 0;
  static bool overflow = false;
  while (Serial.available()) {
    const char c = Serial.read();
    if (c == '\r') continue;
    if (c != '\n') {
      if (used < sizeof(line) - 1) line[used++] = c;
      else overflow = true;
      continue;
    }
    line[used] = 0;
    used = 0;
    if (overflow) { overflow = false; continue; }
    if (!strcmp(line, "MAC")) {
      Serial.println(WiFi.macAddress());
    } else if (!strncmp(line, "PAIR ", 5)) {
      char mac[13], key[33], extraChar;
      unsigned channel;
      Pair pair{};
      const bool valid = sscanf(line + 5, "%12s %32s %u %c", mac, key, &channel, &extraChar) == 3 &&
        channel >= 1 && channel <= 13 && decode(mac, pair.mac, 6) &&
        decode(key, pair.key, 16) && strspn(key,"0") != 32 && !(pair.mac[0] & 1);
      if (!valid) { Serial.println("Format: PAIR MAC12 KEY32 CHANNEL"); continue; }
      pair.channel = channel;
      if (prefs.putBytes("esp-pair", &pair, sizeof(pair)) != sizeof(pair)) {
        Serial.println("Pairing gagal disimpan.");
        continue;
      }
      Serial.println("Pairing tersimpan. Restart perangkat.");
    } else if (extra && line[0]) {
      extra(line);
    }
  }
}
}

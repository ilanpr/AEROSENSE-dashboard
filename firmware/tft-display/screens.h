// Screen layouts for the 1.8" 160x128 TFT (landscape). Uses only the Adafruit_GFX API,
// so the same code draws on the ST7735 and in the computer preview test.
#pragma once
#include <Adafruit_GFX.h>
#include <Fonts/FreeSansBold18pt7b.h>
#include <Fonts/FreeSansBold9pt7b.h>
#include <stdio.h>
#include <time.h>
#include "logo_aerosense.h"
#include "reading.h"

namespace screen {

constexpr uint16_t rgb(uint8_t r, uint8_t g, uint8_t b) { return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3); }
constexpr uint16_t LOGO_BG = 0xF7DF;
constexpr uint16_t PAPER = rgb(244, 248, 253);
constexpr uint16_t BRAND = rgb(7, 89, 188);
constexpr uint16_t INK = rgb(16, 38, 63);
constexpr uint16_t MUTED = rgb(74, 101, 132);
constexpr uint16_t LINE = rgb(211, 227, 246);
constexpr uint16_t GOOD = rgb(19, 122, 79);
constexpr uint16_t WARN = rgb(196, 120, 0);
constexpr uint16_t DANGER = rgb(176, 36, 56);
constexpr uint16_t WHITE = 0xFFFF;

// "19,7" style numbers; '-' when the sensor has no value.
inline void number(char* out, size_t size, float v, int decimals) {
  if (isnan(v)) { snprintf(out, size, "-"); return; }
  snprintf(out, size, "%.*f", decimals, v);
  for (char* p = out; *p; p++) if (*p == '.') *p = ',';
}

inline void text(Adafruit_GFX& g, int16_t x, int16_t y, const char* s, uint16_t color, const GFXfont* font = nullptr) {
  g.setFont(font);
  g.setTextSize(1);
  g.setTextColor(color);
  g.setCursor(x, y);
  g.print(s);
}

inline int16_t textWidth(Adafruit_GFX& g, const char* s, const GFXfont* font = nullptr) {
  int16_t x1, y1; uint16_t w, h;
  g.setFont(font);
  g.setTextSize(1);
  g.getTextBounds(s, 0, 0, &x1, &y1, &w, &h);
  return static_cast<int16_t>(w);
}

// Converts "2026-10-23T09:32:10.000Z" to "16.32" in WIB (UTC+7).
inline void wibClock(const char* iso, char* out, size_t size) {
  int y, mo, d, h, mi;
  if (!iso || sscanf(iso, "%4d-%2d-%2dT%2d:%2d", &y, &mo, &d, &h, &mi) != 5) { snprintf(out, size, "--.--"); return; }
  snprintf(out, size, "%02d.%02d", (h + 7) % 24, mi);
}

// Header shows the node name (shortened to fit), a freshness tag and the reading time.
inline void header(Adafruit_GFX& g, const char* title, const char* clock, const char* tag, uint16_t tagColor) {
  g.fillRect(0, 0, g.width(), 16, BRAND);
  int16_t x = g.width() - 4 - textWidth(g, clock);
  text(g, x, 4, clock, WHITE);
  if (tag && *tag) {
    int16_t w = textWidth(g, tag) + 8;
    x -= w + 4;
    g.fillRoundRect(x, 3, w, 11, 3, tagColor);
    text(g, x + 4, 5, tag, WHITE);
  }
  char name[28];
  snprintf(name, sizeof(name), "%s", title);
  for (size_t n = strlen(name); n > 1 && textWidth(g, name) > x - 9; n--) { name[n - 1] = '\0'; name[n - 2] = '.'; }
  text(g, 5, 4, name, WHITE);
}

inline void logo(Adafruit_GFX& g) {
  g.fillScreen(LOGO_BG);
  g.drawRGBBitmap((g.width() - LOGO_W) / 2, (g.height() - LOGO_H) / 2, AEROSENSE_LOGO, LOGO_W, LOGO_H);
}

inline void message(Adafruit_GFX& g, const char* clock, const char* title, const char* detail) {
  g.fillScreen(PAPER);
  header(g, "AEROSENSE", clock, "", BRAND);
  text(g, (g.width() - textWidth(g, title, &FreeSansBold9pt7b)) / 2, 62, title, INK, &FreeSansBold9pt7b);
  text(g, (g.width() - textWidth(g, detail)) / 2, 76, detail, MUTED);
}

inline void cell(Adafruit_GFX& g, int16_t x, int16_t y, const char* label, const char* value, const char* unit) {
  text(g, x, y, label, MUTED);
  text(g, x, y + 23, value, INK, &FreeSansBold9pt7b);
  text(g, x + textWidth(g, value, &FreeSansBold9pt7b) + 4, y + 16, unit, MUTED);
}

inline void reading(Adafruit_GFX& g, const Reading& r, const char* clock) {
  g.fillScreen(PAPER);
  const bool old = r.stale || r.invalid;
  header(g, r.name, clock, r.invalid ? "TIDAK VALID" : r.stale ? "LAMA" : "LIVE", r.invalid ? DANGER : r.stale ? WARN : GOOD);

  // Main value: optical dust, or PM2.5 only when the node is validated for it.
  text(g, 5, 21, r.pm25 ? "PM2.5 (ug/m3)" : "Debu optik (ug/m3)", MUTED);
  char value[12];
  number(value, sizeof(value), r.particle, 1);
  text(g, 5, 57, value, old ? MUTED : INK, &FreeSansBold18pt7b);

  const char* level = r.level == Level::Danger ? "BAHAYA" : r.level == Level::Warning ? "WASPADA" : r.level == Level::Good ? "BAIK" : "";
  if (*level && !old) {
    uint16_t color = r.level == Level::Danger ? DANGER : r.level == Level::Warning ? WARN : GOOD;
    int16_t w = textWidth(g, level) + 10;
    g.fillRoundRect(g.width() - w - 5, 36, w, 15, 4, color);
    text(g, g.width() - w, 40, level, WHITE);
  }

  g.drawFastHLine(5, 63, g.width() - 10, LINE);
  char v[12];
  number(v, sizeof(v), r.eco2, 0);        cell(g, 5, 67, "eCO2", v, "ppm");
  number(v, sizeof(v), r.tvoc, 0);        cell(g, 84, 67, "TVOC", v, "ppb");
  number(v, sizeof(v), r.temperature, 1); cell(g, 5, 97, "Suhu", v, "C");
  number(v, sizeof(v), r.humidity, 0);    cell(g, 84, 97, "Kelembapan", v, "%");
}

}  // namespace screen

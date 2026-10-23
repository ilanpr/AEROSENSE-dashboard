// Screens for the 1.8" 160x128 ST7735 (landscape) on the sensor node. Only Adafruit_GFX calls,
// so the same code draws on the TFT, into a GFXcanvas16, and in the computer preview test.
#pragma once
#include <Adafruit_GFX.h>
#include <Fonts/FreeSansBold18pt7b.h>
#include <Fonts/FreeSansBold9pt7b.h>
#include <stdio.h>
#include "logo_aerosense.h"
#include "node_logic.h"

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
constexpr uint16_t SKY = rgb(56, 140, 230);
constexpr uint16_t WHITE = 0xFFFF;

inline void number(char* out, size_t size, float v, int decimals) {
  if (isnan(v)) { snprintf(out, size, "-"); return; }
  snprintf(out, size, "%.*f", decimals, v);
  for (char* p = out; *p; p++) if (*p == '.') *p = ',';
}

inline void text(Adafruit_GFX& g, int16_t x, int16_t y, const char* s, uint16_t color, const GFXfont* font = nullptr) {
  g.setFont(font); g.setTextSize(1); g.setTextColor(color); g.setCursor(x, y); g.print(s);
}

inline int16_t textWidth(Adafruit_GFX& g, const char* s, const GFXfont* font = nullptr) {
  int16_t x1, y1; uint16_t w, h;
  g.setFont(font); g.setTextSize(1);
  g.getTextBounds(s, 0, 0, &x1, &y1, &w, &h);
  return static_cast<int16_t>(w);
}

inline void pill(Adafruit_GFX& g, int16_t rightX, int16_t y, int16_t h, const char* label, uint16_t color) {
  int16_t w = textWidth(g, label) + 8;
  g.fillRoundRect(rightX - w, y, w, h, 3, color);
  text(g, rightX - w + 4, y + (h - 7) / 2, label, WHITE);
}

inline void linkLabel(const LinkState& link, char* out, size_t size, uint16_t& color) {
  switch (link.state) {
    case Link::Waiting: snprintf(out, size, "LORA ..."); color = MUTED; break;
    case Link::Sent:    snprintf(out, size, "LORA TX"); color = SKY; break;
    case Link::Good:    if (link.hasRssi) snprintf(out, size, "LORA %d", link.rssi); else snprintf(out, size, "LORA OK"); color = GOOD; break;
    case Link::Weak:    if (link.hasRssi) snprintf(out, size, "LEMAH %d", link.rssi); else snprintf(out, size, "LORA LEMAH"); color = WARN; break;
    case Link::Lost:    snprintf(out, size, "LORA PUTUS"); color = DANGER; break;
  }
}

inline void logo(Adafruit_GFX& g) {
  g.fillScreen(LOGO_BG);
  g.drawRGBBitmap((g.width() - LOGO_W) / 2, (g.height() - LOGO_H) / 2, AEROSENSE_LOGO, LOGO_W, LOGO_H);
}

inline void cell(Adafruit_GFX& g, int16_t x, int16_t y, const char* label, const char* value, const char* unit) {
  text(g, x, y, label, MUTED);
  text(g, x, y + 23, value, INK, &FreeSansBold9pt7b);
  text(g, x + textWidth(g, value, &FreeSansBold9pt7b) + 4, y + 16, unit, MUTED);
}

// nextSendS: seconds until the next LoRa packet, shown so field staff know the node is alive.
inline void reading(Adafruit_GFX& g, const char* nodeId, const Sample& s, Level level, const LinkState& link,
                    uint32_t counter, uint32_t nextSendS) {
  g.fillScreen(PAPER);
  g.fillRect(0, 0, g.width(), 16, BRAND);
  char label[16]; uint16_t color;
  linkLabel(link, label, sizeof(label), color);
  pill(g, g.width() - 3, 3, 11, label, color);
  char id[24];
  snprintf(id, sizeof(id), "%s", nodeId);
  const int16_t room = g.width() - 3 - (textWidth(g, label) + 8) - 9;
  for (size_t n = strlen(id); n > 1 && textWidth(g, id) > room; n--) { id[n - 1] = '\0'; id[n - 2] = '.'; }
  text(g, 5, 5, id, WHITE);

  text(g, 5, 21, "Debu ug/m3", MUTED);
  char value[12], status[24];
  number(value, sizeof(value), s.dust, 1);
  text(g, 5, 57, value, INK, &FreeSansBold18pt7b);
  const char* word = level == Level::Danger ? "BAHAYA" : level == Level::Warning ? "WASPADA" : level == Level::Good ? "BAIK" : "";
  if (*word) pill(g, g.width() - 5, 36, 15, word, level == Level::Danger ? DANGER : level == Level::Warning ? WARN : GOOD);
  (void)counter;  // the packet counter goes to Serial and the CSV; the screen shows the countdown
  snprintf(status, sizeof(status), "kirim %lu:%02lu", static_cast<unsigned long>(nextSendS / 60), static_cast<unsigned long>(nextSendS % 60));
  text(g, g.width() - 5 - textWidth(g, status), 21, status, MUTED);

  g.drawFastHLine(5, 63, g.width() - 10, LINE);
  char v[12];
  if (s.sgpWarming) snprintf(v, sizeof(v), "...");
  else number(v, sizeof(v), s.eco2, 0);
  cell(g, 5, 67, "eCO2", v, "ppm");
  if (s.sgpWarming) snprintf(v, sizeof(v), "...");
  else number(v, sizeof(v), s.tvoc, 0);
  cell(g, 84, 67, "TVOC", v, "ppb");
  number(v, sizeof(v), s.temperature, 1); cell(g, 5, 97, "Suhu", v, "C");
  number(v, sizeof(v), s.humidity, 0);    cell(g, 84, 97, "Kelembapan", v, "%");
}

}  // namespace screen

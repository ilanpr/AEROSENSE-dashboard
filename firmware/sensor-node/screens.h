// Screens for the 1.8" 128x160 ST7735 (portrait) on the sensor node. Only Adafruit_GFX calls,
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

// Portrait 128x160. nextSendS: seconds until the next LoRa packet, so field staff see the node is alive.
inline void reading(Adafruit_GFX& g, const char* nodeId, const Sample& s, Level level, const LinkState& link,
                    uint32_t counter, uint32_t nextSendS) {
  (void)counter;  // the packet counter goes to Serial and the CSV
  const int16_t W = g.width();
  g.fillScreen(PAPER);

  // Header: node id
  g.fillRect(0, 0, W, 15, BRAND);
  char id[24];
  snprintf(id, sizeof(id), "%s", nodeId);
  for (size_t n = strlen(id); n > 1 && textWidth(g, id) > W - 8; n--) { id[n - 1] = '\0'; id[n - 2] = '.'; }
  text(g, 4, 4, id, WHITE);

  // Link state and countdown
  char label[16], status[16]; uint16_t color;
  linkLabel(link, label, sizeof(label), color);
  int16_t pw = textWidth(g, label) + 8;
  g.fillRoundRect(3, 18, pw, 11, 3, color);
  text(g, 7, 20, label, WHITE);
  snprintf(status, sizeof(status), "%lu:%02lu", static_cast<unsigned long>(nextSendS / 60), static_cast<unsigned long>(nextSendS % 60));
  text(g, W - 4 - textWidth(g, status), 20, status, MUTED);

  // Main value: optical dust
  text(g, 4, 35, "Debu ug/m3", MUTED);
  char value[12];
  number(value, sizeof(value), s.dust, 1);
  text(g, (W - textWidth(g, value, &FreeSansBold18pt7b)) / 2, 71, value, INK, &FreeSansBold18pt7b);

  // Level bar across the width, easy to read from a distance
  const char* word = level == Level::Danger ? "BAHAYA" : level == Level::Warning ? "WASPADA" : level == Level::Good ? "BAIK" : "BELUM ADA DATA";
  uint16_t barColor = level == Level::Danger ? DANGER : level == Level::Warning ? WARN : level == Level::Good ? GOOD : MUTED;
  g.fillRoundRect(4, 78, W - 8, 17, 4, barColor);
  text(g, (W - textWidth(g, word)) / 2, 83, word, WHITE);

  // 2x2 grid
  g.drawFastHLine(4, 99, W - 8, LINE);
  char v[12];
  const int16_t col = W / 2 + 2;
  if (s.sgpWarming) snprintf(v, sizeof(v), "...");
  else number(v, sizeof(v), s.eco2, 0);
  cell(g, 4, 103, "eCO2 ppm", v, "");
  if (s.sgpWarming) snprintf(v, sizeof(v), "...");
  else number(v, sizeof(v), s.tvoc, 0);
  cell(g, col, 103, "TVOC ppb", v, "");
  number(v, sizeof(v), s.temperature, 1); cell(g, 4, 132, "Suhu C", v, "");
  number(v, sizeof(v), s.humidity, 0);    cell(g, col, 132, "RH %", v, "");
}

}  // namespace screen

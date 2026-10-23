// Copy to config.h and fill in. config.h is not committed.
#pragma once

#define WIFI_SSID "nama-wifi"
#define WIFI_PASSWORD "password-wifi"

// Public monitoring API. The node must be published (public_read = true) to be readable without login.
#define API_BASE "https://aerosense.me/api"
// demo-its-01 is a published simulation node, handy for the first test. Then use your own node id.
#define NODE_ID "demo-its-01"
#define REFRESH_MS 30000

// ESP32-S3 pins for the 1.8" ST7735 module (pin label on the module -> GPIO).
#define TFT_SCK 12   // SCL
#define TFT_MOSI 11  // SDA
#define TFT_CS 10    // CS
#define TFT_DC 9     // DC (A0)
#define TFT_RST 8    // RES
#define TFT_BL 7     // BL (backlight). Or wire BL to 3V3 and set -1.

// Panel variant. Start with INITR_BLACKTAB. If the picture is shifted or has a noisy edge,
// try INITR_GREENTAB; if red and blue are swapped, try INITR_REDTAB.
#define TFT_TAB INITR_BLACKTAB
// Set to 1 if every colour looks inverted (white looks black).
#define TFT_INVERT 0

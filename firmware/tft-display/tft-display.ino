// AEROSENSE display: 1.8" 128x160 ST7735 TFT on ESP32-S3 (Arduino core 3.x).
// Shows the AEROSENSE logo at start, then the latest reading of one node.
// Libraries: Adafruit ST7735 and ST7789, Adafruit GFX, ArduinoJson 7.
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <Adafruit_ST7735.h>
#include "config.h"
#include "screens.h"

SPIClass spi(FSPI);
Adafruit_ST7735 tft(&spi, TFT_CS, TFT_DC, TFT_RST);
Reading last;
uint32_t lastFetch = 0;
bool fetchedOnce = false;

void showReading(const Reading& r) {
  char clock[8];
  screen::wibClock(r.observedAt, clock, sizeof(clock));
  screen::reading(tft, r, clock);
}

bool fetchReading(Reading& out, char* error, size_t errorSize) {
  String url = String(API_BASE) + "/v1/public/nodes?node_id=" + NODE_ID;
  HTTPClient http;
  http.setTimeout(10000);
  WiFiClientSecure secure;
  WiFiClient plain;
  bool ok;
  if (url.startsWith("https://")) {
    // Read-only public data. For a stricter setup pin the server certificate with setCACert().
    secure.setInsecure();
    ok = http.begin(secure, url);
  } else {
    ok = http.begin(plain, url);
  }
  if (!ok) { snprintf(error, errorSize, "Alamat API tidak valid"); return false; }
  int code = http.GET();
  if (code != 200) {
    snprintf(error, errorSize, code > 0 ? "Server menjawab HTTP %d" : "Server tidak terjangkau (%d)", code);
    http.end();
    return false;
  }
  String body = http.getString();
  http.end();
  out = parseReading(body.c_str(), body.length());
  if (!out.ok) { snprintf(error, errorSize, "%s", out.error); return false; }
  return true;
}

void refresh() {
  if (WiFi.status() != WL_CONNECTED) {
    if (last.ok) { Reading old = last; old.stale = true; showReading(old); }
    else screen::message(tft, "--.--", "Wi-Fi terputus", "Menyambung ulang...");
    return;
  }
  Reading next;
  char error[48];
  if (fetchReading(next, error, sizeof(error))) {
    last = next;
    showReading(last);
  } else if (last.ok) {
    Reading old = last;   // keep the last value visible, clearly marked as old
    old.stale = true;
    showReading(old);
  } else {
    screen::message(tft, "--.--", "Belum ada data", error);
  }
}

void setup() {
  Serial.begin(115200);
#if TFT_BL >= 0
  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_BL, HIGH);
#endif
  spi.begin(TFT_SCK, -1, TFT_MOSI, TFT_CS);
  tft.initR(TFT_TAB);
  tft.setSPISpeed(27000000);
  tft.setRotation(1);   // landscape 160x128
  tft.invertDisplay(TFT_INVERT);
  screen::logo(tft);
  const uint32_t logoShown = millis();
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED && millis() - logoShown < 15000) delay(200);
  while (millis() - logoShown < 2500) delay(50);  // keep the logo visible briefly
  refresh();
  lastFetch = millis();
}

void loop() {
  if (millis() - lastFetch >= REFRESH_MS) {
    lastFetch = millis();
    refresh();
  }
  delay(50);
}

// Renders the TFT screens to PNG-ready PPM files using the real Adafruit_GFX code.
#include "Arduino.h"
#include "../screens.h"
#include <fstream>
#include <string>
#include <cassert>
#include <iostream>
class Frame : public Adafruit_GFX {
 public:
  uint16_t px[160 * 128];
  Frame() : Adafruit_GFX(160, 128) {}
  void drawPixel(int16_t x, int16_t y, uint16_t c) override { if (x >= 0 && y >= 0 && x < 160 && y < 128) px[y * 160 + x] = c; }
  void save(const std::string& path) {
    std::ofstream f(path, std::ios::binary); f << "P6\n160 128\n255\n";
    for (uint16_t c : px) { unsigned char rgb[3] = {(unsigned char)((c >> 11) << 3), (unsigned char)(((c >> 5) & 63) << 2), (unsigned char)((c & 31) << 3)}; f.write((char*)rgb, 3); }
  }
};
int main(int, char** argv) {
  std::string dir = argv[1];
  Frame f;
  screen::logo(f); f.save(dir + "/logo.ppm");
  const char* json = R"({"nodes":[{"id":"node-01","name":"Area Produksi Pabrik","pm25_validated":false,
    "rules":[{"metric":"dust_ug_m3","high":35,"danger_high":55,"clear_below":30,"enabled":true,"active":false,"unit":"µg/m³"}],
    "latest":{"node_id":"node-01","name":"Area Produksi Pabrik","reading_id":"r1","observed_at":"2026-10-23T09:32:10.000Z","stale":false,
      "metrics":{"dust_ug_m3":19.73,"eco2_ppm":467,"tvoc_ppb":115,"temperature_c":29.6,"humidity_pct":69},"quality":{"invalid":false}}}],"refreshed_at":"x"})";
  Reading r = parseReading(json, strlen(json));
  assert(r.ok && r.level == Level::Good && fabs(r.particle - 19.73f) < 0.01 && r.high == 35);
  char clock[8]; screen::wibClock(r.observedAt, clock, sizeof clock);
  assert(std::string(clock) == "16.32");
  screen::reading(f, r, clock); f.save(dir + "/good.ppm");
  std::string danger = json; danger.replace(danger.find("19.73"), 5, "61.20");
  r = parseReading(danger.c_str(), danger.size()); assert(r.level == Level::Danger);
  screen::reading(f, r, clock); f.save(dir + "/danger.ppm");
  std::string stale = json; stale.replace(stale.find("\"stale\":false"), 13, "\"stale\":true ");
  r = parseReading(stale.c_str(), stale.size()); assert(r.stale);
  screen::reading(f, r, clock); f.save(dir + "/stale.ppm");
  const char* none = R"({"nodes":[],"refreshed_at":"x"})";
  r = parseReading(none, strlen(none)); assert(!r.ok && std::string(r.error) == "Node belum dipublikasikan");
  screen::message(f, "--.--", "Belum ada data", r.error); f.save(dir + "/error.ppm");
  std::cout << "preview rendered\n";
}

// Renders node screens with the real Adafruit_GFX code and checks the pure node logic.
#include "Arduino.h"
#include "../screens.h"
#include <cassert>
#include <fstream>
#include <iostream>
#include <string>
class Frame : public Adafruit_GFX {
 public:
  uint16_t px[128 * 160];
  Frame() : Adafruit_GFX(128, 160) {}
  void drawPixel(int16_t x, int16_t y, uint16_t c) override { if (x >= 0 && y >= 0 && x < 128 && y < 160) px[y * 128 + x] = c; }
  void save(const std::string& path) {
    std::ofstream f(path, std::ios::binary); f << "P6\n128 160\n255\n";
    for (uint16_t c : px) { unsigned char rgb[3] = {(unsigned char)((c >> 11) << 3), (unsigned char)(((c >> 5) & 63) << 2), (unsigned char)((c & 31) << 3)}; f.write((char*)rgb, 3); }
  }
};
int main(int, char** argv) {
  std::string dir = argv[1];
  // Logic checks
  assert(sharpDust(0.6f, 0.6f) == 0.0f);
  assert(fabs(sharpDust(0.7f, 0.6f) - 20.0f) < 0.01f);
  assert(sharpDust(0.3f, 0.6f) == 0.0f);
  assert(levelFor(20, 35, 55) == Level::Good && levelFor(40, 35, 55) == Level::Warning && levelFor(60, 35, 55) == Level::Danger);
  Sample s; s.dust = 42.13f; s.eco2 = 610; s.tvoc = 145; s.temperature = 31.24f; s.humidity = 78.5f;
  char line[96]; csvLine(line, sizeof line, "NODE_SIDOMORO_01", 81, s);
  assert(std::string(line) == "NODE_SIDOMORO_01,81,31.2,610,145,42.1,78.5\n");
  Sample missing; csvLine(line, sizeof line, "N1", 1, missing);
  assert(std::string(line) == "N1,1,nan,nan,nan,nan,nan\n");
  int rssi = 0; bool has = false;
  assert(parseAck("ACK,NODE_SIDOMORO_01,81,-87", "NODE_SIDOMORO_01", 81, rssi, has) && has && rssi == -87);
  assert(parseAck("ACK,NODE_SIDOMORO_01,81", "NODE_SIDOMORO_01", 81, rssi, has) && !has);
  assert(!parseAck("ACK,NODE_SIDOMORO_01,80,-87", "NODE_SIDOMORO_01", 81, rssi, has));
  assert(!parseAck("ACK,NODE_SIDOMORO_011,81", "NODE_SIDOMORO_01", 81, rssi, has));
  LinkState link; link.acked(-87, true, -105); assert(link.state == Link::Good);
  link.timedOut(3); assert(link.state == Link::Weak);
  link.timedOut(3); link.timedOut(3); assert(link.state == Link::Lost);
  link.acked(-112, true, -105); assert(link.state == Link::Weak && link.misses == 0);
  // Screens
  Frame f;
  screen::logo(f); f.save(dir + "/logo.ppm");
  LinkState good; good.acked(-87, true, -105);
  screen::reading(f, "NODE_SIDOMORO_01", s, levelFor(s.dust, 35, 55), good, 81, 252); f.save(dir + "/warning.ppm");
  Sample clean = s; clean.dust = 18.4f;
  LinkState sent; sent.sent(false);
  screen::reading(f, "NODE_SIDOMORO_01", clean, levelFor(clean.dust, 35, 55), sent, 82, 299); f.save(dir + "/good.ppm");
  Sample bad = s; bad.dust = 63.0f; bad.sgpWarming = true;
  LinkState lost; lost.timedOut(3); lost.timedOut(3); lost.timedOut(3);
  screen::reading(f, "NODE_SIDOMORO_01", bad, levelFor(bad.dust, 35, 55), lost, 7, 41); f.save(dir + "/danger.ppm");
  std::cout << "logic checks passed, preview rendered\n";
}

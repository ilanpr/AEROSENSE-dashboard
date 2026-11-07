#pragma once
#include "WiFi.h"
#include <functional>
struct Pub { std::string topic, body; bool retained; };
extern std::vector<Pub> g_pubs; extern bool g_broker;
class PubSubClient {
 public:
  std::function<void(char*, byte*, unsigned int)> cb; bool conn = false; std::string sub;
  PubSubClient(WiFiClient&) {}
  void setServer(const char*, int) {} void setBufferSize(int) {} void setKeepAlive(int) {}
  void setCallback(void (*f)(char*, byte*, unsigned int)) { cb = f; }
  bool connect(const char*, const char*, const char*, const char*, int, bool, const char*, bool) { conn = g_broker && g_wifi; return conn; }
  bool connected() { if (!g_broker || !g_wifi) conn = false; return conn; }
  bool subscribe(const char* t, int) { sub = t; return true; }
  bool publish(const char* t, const char* b, bool r) { g_pubs.push_back({t, b, r}); return true; }
  void loop() {}
  int state() { return -2; }
  void inject(const std::string& topic, const std::string& body) { std::vector<byte> buf(body.begin(), body.end()); std::string t = topic; cb(&t[0], buf.data(), buf.size()); }
};

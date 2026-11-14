#pragma once
#include <WebServer.h>
#include <esp_random.h>

struct NetworkSettings {
  char id[41], ssid[33], wifiPassword[64], broker[254], mqttPassword[129];
  uint16_t port;
};

inline bool loadNetwork(Preferences& prefs, NetworkSettings& settings) {
  return prefs.getBytesLength("network") == sizeof(settings) &&
         prefs.getBytes("network", &settings, sizeof(settings)) == sizeof(settings) &&
         settings.id[0] && settings.ssid[0] && settings.broker[0] &&
         settings.mqttPassword[0] && settings.port;
}

inline void configureNetwork(Preferences& prefs, const NetworkSettings& saved) {
  WiFi.mode(WIFI_AP);
  String password = prefs.getString("setup-key");
  if (password.length() < 12) {
    char key[17];
    snprintf(key, sizeof(key), "%08lx%08lx", (unsigned long)esp_random(),
             (unsigned long)esp_random());
    password = key;
    prefs.putString("setup-key", password);
  }
  char setupSsid[24];
  snprintf(setupSsid, sizeof(setupSsid), "WATERSENSE-%06lX",
           (unsigned long)(ESP.getEfuseMac() & 0xffffff));
  if (!WiFi.softAP(setupSsid, password.c_str(), 1, false, 1)) {
    Serial.println("Wi-Fi pengaturan tidak dapat dimulai.");
    return;
  }
  Serial.printf("Wi-Fi pengaturan: %s | Kata sandi: %s | http://%s\n",
                setupSsid, password.c_str(), WiFi.softAPIP().toString().c_str());

  WebServer portal(80);
  String token = String(esp_random(), HEX) + String(esp_random(), HEX);
  portal.on("/", HTTP_GET, [&] {
    String page = "<!doctype html><meta name='viewport' content='width=device-width'>"
                  "<title>WATERSENSE</title><style>body{font:16px system-ui;max-width:32rem;"
                  "margin:2rem auto;padding:0 1rem}label,input{display:block}input{width:100%;"
                  "padding:.5rem;box-sizing:border-box;margin:.25rem 0 1rem}button{padding:.6rem}</style>"
                  "<h1>Pengaturan WATERSENSE</h1><form method='post' action='/save'>"
                  "<input type='hidden' name='token' value='" + token + "'>"
                  "<label>ID WATERSENSE<input name='id' maxlength='40' placeholder='mist-01' required value='" +
                  String(saved.id) + "'></label>"
                  "<label>Nama Wi-Fi 2,4 GHz<input name='ssid' maxlength='32' required></label>"
                  "<label>Kata sandi Wi-Fi<input name='wifi' type='password' minlength='8' maxlength='63' required></label>"
                  "<label>Alamat broker MQTT (contoh aerosense.me)<input name='broker' maxlength='253' required value='" +
                  String(saved.broker) + "'></label>"
                  "<label>Port MQTT (443 internet, 1883 LAN)<input name='port' type='number' min='1' max='65535' value='" +
                  String(saved.port ? saved.port : 1883) + "' required></label>"
                  "<label>Kata sandi MQTT perangkat<input name='mqtt' type='password' maxlength='128' required></label>"
                  "<button>Simpan dan sambungkan</button></form>";
    portal.sendHeader("Cache-Control", "no-store");
    portal.send(200, "text/html; charset=utf-8", page);
  });
  bool restart = false;
  portal.on("/save", HTTP_POST, [&] {
    NetworkSettings next{};
    const String id = portal.arg("id"), ssid = portal.arg("ssid"), wifi = portal.arg("wifi"),
                 broker = portal.arg("broker"), port = portal.arg("port"), mqtt = portal.arg("mqtt");
    const long number = port.toInt();
    if (portal.arg("token") != token || !id.length() || id.length() >= sizeof(next.id) ||
        id == "n8n-aerosense" || strspn(id.c_str(), "abcdefghijklmnopqrstuvwxyz0123456789-") != id.length() ||
        !ssid.length() || ssid.length() >= sizeof(next.ssid) ||
        wifi.length() < 8 || wifi.length() >= sizeof(next.wifiPassword) ||
        !broker.length() || broker.length() >= sizeof(next.broker) ||
        strspn(broker.c_str(), "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.") != broker.length() ||
        !port.length() || strspn(port.c_str(), "0123456789") != port.length() ||
        number < 1 || number > 65535 || !mqtt.length() || mqtt.length() >= sizeof(next.mqttPassword)) {
      portal.send(400, "text/plain", "Pengaturan tidak valid. Kembali dan periksa isian.");
      return;
    }
    strlcpy(next.id, id.c_str(), sizeof(next.id));
    strlcpy(next.ssid, ssid.c_str(), sizeof(next.ssid));
    strlcpy(next.wifiPassword, wifi.c_str(), sizeof(next.wifiPassword));
    strlcpy(next.broker, broker.c_str(), sizeof(next.broker));
    strlcpy(next.mqttPassword, mqtt.c_str(), sizeof(next.mqttPassword));
    next.port = static_cast<uint16_t>(number);
    restart = prefs.putBytes("network", &next, sizeof(next)) == sizeof(next);
    portal.send(restart ? 200 : 500, "text/plain",
                restart ? "Tersimpan. WATERSENSE akan menyambung ke Wi-Fi pilihan."
                        : "Pengaturan gagal disimpan. Coba lagi.");
  });
  portal.begin();
  const uint32_t started=millis();
  while (!restart && millis()-started < 300000) {
    portal.handleClient();
    delay(5);
  }
  if (restart) {
    delay(750);
    ESP.restart();
  }
  portal.stop();
  WiFi.softAPdisconnect(true);
  Serial.println("Portal pengaturan ditutup. Kirim SETUP untuk membukanya lagi.");
}

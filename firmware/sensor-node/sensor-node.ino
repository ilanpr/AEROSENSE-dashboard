// AEROSENSE sensor node: ESP32-S3 + SGP30 + Sharp GP2Y1010AU0F + AM2301 + EBYTE E220 + 1.8" ST7735.
// Shows the AEROSENSE logo at start, then live readings straight from the sensors, the LoRa link
// state and BAIK / WASPADA / BAHAYA. Sends one CSV line to the gateway every SEND_INTERVAL_S.
// Libraries: Adafruit ST7735 and ST7789, Adafruit GFX, Adafruit SGP30, DHT sensor library (Adafruit).
#include <Wire.h>
#include <SPI.h>
#include <Adafruit_ST7735.h>
#include <Adafruit_SGP30.h>
#include <DHT.h>
#include "config.h"
#ifndef TFT_ROTATION
#define TFT_ROTATION 0   // portrait; older config.h files do not define it
#endif
#ifndef DHT_TYPE
#define DHT_TYPE DHT21   // AM2301
#endif
#ifndef BATTERY_PIN
#define BATTERY_PIN -1
#endif
#ifndef BATTERY_DIVIDER
#define BATTERY_DIVIDER 2.0
#endif
#ifndef SERIAL_LOG_S
#define SERIAL_LOG_S 5   // readable sensor line on Serial Monitor; 0 to turn off
#endif
#include "screens.h"

SPIClass tftSpi(FSPI);
Adafruit_ST7735 tft(&tftSpi, TFT_CS, TFT_DC, TFT_RST);
GFXcanvas16 canvas(128, 160);   // draw off-screen, then push in one go: no flicker
Adafruit_SGP30 sgp;
DHT dht(DHT_PIN, DHT_TYPE);
HardwareSerial lora(1);

Sample live;
bool sgpOk = false;
uint32_t sgpStartMs = 0;
float dustRing[10];
uint8_t dustRingCount = 0, dustRingNext = 0;
double dustSum = 0;              // since the last packet
uint32_t dustSamples = 0;
uint32_t counter = 0;
LinkState loraLink;
bool awaitingAck = false;
uint32_t ackDeadline = 0;
char rxLine[96];
size_t rxLen = 0;
uint32_t lastSgp = 0, lastDht = 0, lastDust = 0, lastDraw = 0, lastLog = 0, nextSendMs = 0;
float lastSharpVolts = NAN;

float readSharpVolts() {
  // Datasheet timing: LED on, sample at 0.28 ms, LED off after 0.32 ms, 10 ms cycle.
  uint32_t total = 0;
  for (int i = 0; i < 10; i++) {
    digitalWrite(SHARP_LED_PIN, SHARP_LED_ACTIVE_LOW ? LOW : HIGH);
    delayMicroseconds(280);
    total += analogReadMilliVolts(SHARP_VO_PIN);
    delayMicroseconds(40);
    digitalWrite(SHARP_LED_PIN, SHARP_LED_ACTIVE_LOW ? HIGH : LOW);
    delayMicroseconds(9680);
  }
  return total / 10.0f / 1000.0f * SHARP_DIVIDER;
}

void readDust() {
  lastSharpVolts = readSharpVolts();
  float ug = sharpDust(lastSharpVolts, SHARP_ZERO_V);
  dustRing[dustRingNext] = ug;
  dustRingNext = (dustRingNext + 1) % 10;
  if (dustRingCount < 10) dustRingCount++;
  float sum = 0;
  for (uint8_t i = 0; i < dustRingCount; i++) sum += dustRing[i];
  live.dust = sum / dustRingCount;   // ~10 s moving average for the screen
  dustSum += ug;
  dustSamples++;
}

void readDht() {
  float t = dht.readTemperature(), h = dht.readHumidity();
  live.temperature = t;
  live.humidity = h;
  if (sgpOk && !isnan(t) && !isnan(h)) {
    // Absolute humidity (mg/m³) for SGP30 humidity compensation (Sensirion formula).
    float ah = 216.7f * ((h / 100.0f) * 6.112f * expf((17.62f * t) / (243.12f + t)) / (273.15f + t));
    sgp.setHumidity(static_cast<uint32_t>(ah * 1000.0f));
  }
}

void readSgp() {
  if (!sgpOk) { live.eco2 = live.tvoc = NAN; return; }
  // SGP30 must be measured every second to keep its baseline algorithm running.
  if (!sgp.IAQmeasure()) { live.eco2 = live.tvoc = NAN; return; }
  live.sgpWarming = millis() - sgpStartMs < 15000;
  live.eco2 = sgp.eCO2;
  live.tvoc = sgp.TVOC;
}

float readBatteryVolts() {
#if BATTERY_PIN >= 0
  uint32_t total = 0;
  for (int i = 0; i < 8; i++) total += analogReadMilliVolts(BATTERY_PIN);
  return total / 8.0f / 1000.0f * BATTERY_DIVIDER;
#else
  return NAN;
#endif
}

// One plain line per SERIAL_LOG_S for bench testing. The screen is not affected.
void logReadings() {
  Serial.printf("Baca | debu %.1f ug/m3 (Vo %.2f V) | eCO2 %.0f ppm | TVOC %.0f ppb%s | suhu %.1f C | RH %.1f %%",
    live.dust, lastSharpVolts, live.eco2, live.tvoc, live.sgpWarming ? " (pemanasan)" : "",
    live.temperature, live.humidity);
#if BATTERY_PIN >= 0
  Serial.printf(" | baterai %.2f V", readBatteryVolts());
#endif
#if LORA_AUX >= 0
  Serial.printf(" | AUX %s", digitalRead(LORA_AUX) ? "siap" : "sibuk");
#endif
  if (isnan(live.temperature) || isnan(live.humidity)) Serial.print(" | AM2301 tidak terbaca: cek GPIO DHT_PIN");
  if (lastSharpVolts > 3.0f) Serial.print(" | Vo mendekati batas ADC");
  Serial.println();
}

void sendPacket() {
  Sample packet = live;
  if (dustSamples) packet.dust = static_cast<float>(dustSum / dustSamples);  // mean over the interval
  if (packet.sgpWarming) packet.eco2 = packet.tvoc = NAN;
  dustSum = 0;
  dustSamples = 0;
  counter++;
  char line[96];
  csvLine(line, sizeof(line), NODE_ID, counter, packet);
#if LORA_AUX >= 0
  uint32_t waitStart = millis();
  while (digitalRead(LORA_AUX) == LOW && millis() - waitStart < 200) delay(1);  // module busy
#endif
  lora.print(line);
  Serial.print("LoRa TX ");
  Serial.print(line);
  loraLink.sent(ACK_MODE);
  awaitingAck = ACK_MODE;
  ackDeadline = millis() + ACK_TIMEOUT_MS;
}

void readLora() {
  while (lora.available()) {
    char c = static_cast<char>(lora.read());
    if (c == '\r') continue;
    if (c != '\n') { if (rxLen < sizeof(rxLine) - 1) rxLine[rxLen++] = c; continue; }
    rxLine[rxLen] = '\0';
    rxLen = 0;
    int rssi = 0;
    bool hasRssi = false;
    if (awaitingAck && parseAck(rxLine, NODE_ID, counter, rssi, hasRssi)) {
      loraLink.acked(rssi, hasRssi, LORA_WEAK_BELOW);
      awaitingAck = false;
      Serial.printf("ACK #%lu rssi %d\n", static_cast<unsigned long>(counter), hasRssi ? rssi : 0);
    }
  }
  if (awaitingAck && static_cast<int32_t>(millis() - ackDeadline) >= 0) {
    awaitingAck = false;
    loraLink.timedOut(LORA_LOST_AFTER);
    Serial.printf("No ACK for #%lu\n", static_cast<unsigned long>(counter));
  }
}

void draw() {
  uint32_t left = static_cast<int32_t>(nextSendMs - millis()) > 0 ? (nextSendMs - millis() + 999) / 1000 : 0;
  screen::reading(canvas, NODE_ID, live, levelFor(live.dust, DUST_WARNING, DUST_DANGER), loraLink, counter, left);
  tft.drawRGBBitmap(0, 0, canvas.getBuffer(), canvas.width(), canvas.height());
}

void setup() {
  Serial.begin(115200);
  pinMode(SHARP_LED_PIN, OUTPUT);
  digitalWrite(SHARP_LED_PIN, SHARP_LED_ACTIVE_LOW ? HIGH : LOW);
  analogSetPinAttenuation(SHARP_VO_PIN, ADC_11db);
#if TFT_BL >= 0
  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_BL, HIGH);
#endif
#if LORA_AUX >= 0
  pinMode(LORA_AUX, INPUT);
#endif
  tftSpi.begin(TFT_SCK, -1, TFT_MOSI, TFT_CS);
  tft.initR(TFT_TAB);
  tft.setSPISpeed(27000000);
  tft.setRotation(TFT_ROTATION);
  tft.invertDisplay(TFT_INVERT);
  screen::logo(tft);
  const uint32_t logoShown = millis();

  Wire.begin(SGP_SDA, SGP_SCL);
  sgpOk = sgp.begin(&Wire);
  sgpStartMs = millis();
  if (sgpOk) sgp.IAQinit();
  else Serial.println("SGP30 tidak terdeteksi: cek SDA/SCL GPIO 8/9 dan 3V3");
  dht.begin();
  lora.begin(LORA_BAUD, SERIAL_8N1, LORA_RX, LORA_TX);
#if BATTERY_PIN >= 0
  analogSetPinAttenuation(BATTERY_PIN, ADC_11db);
#endif
  Serial.printf("AEROSENSE %s | DHT GPIO %d | Sharp LED %d Vo %d | LoRa RX %d TX %d AUX %d | SGP30 %s\n",
    NODE_ID, DHT_PIN, SHARP_LED_PIN, SHARP_VO_PIN, LORA_RX, LORA_TX, LORA_AUX, sgpOk ? "OK" : "GAGAL");

  while (millis() - logoShown < 3000) { readSgp(); delay(1000); }   // logo while sensors start
  nextSendMs = millis() + 30000;   // first packet after SGP30 warm-up and a few dust samples
}

void loop() {
  const uint32_t now = millis();
  if (now - lastSgp >= 1000) { lastSgp = now; readSgp(); }
  if (now - lastDust >= 1000) { lastDust = now; readDust(); }
  if (now - lastDht >= 2500) { lastDht = now; readDht(); }
  if (static_cast<int32_t>(now - nextSendMs) >= 0) { nextSendMs = now + SEND_INTERVAL_S * 1000UL; sendPacket(); }
  readLora();
  if (SERIAL_LOG_S > 0 && now - lastLog >= SERIAL_LOG_S * 1000UL) { lastLog = now; logReadings(); }
  if (now - lastDraw >= 1000) { lastDraw = now; draw(); }
  delay(5);
}

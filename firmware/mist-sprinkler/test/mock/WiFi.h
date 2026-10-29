#pragma once
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <string>
#include <vector>
#include <map>
typedef uint8_t byte;
#define HIGH 1
#define LOW 0
#define OUTPUT 1
#define INPUT_PULLUP 2
#define WIFI_STA 1
#define WL_CONNECTED 3
extern uint32_t g_millis; extern long g_epoch; extern int g_pins[64]; extern bool g_wifi;
inline void pinMode(int, int) {}
inline void digitalWrite(int p, int v) { g_pins[p] = v; }
inline int digitalRead(int p) { return g_pins[p]; }
inline uint32_t millis() { return g_millis; }
inline void delay(uint32_t ms) { g_millis += ms; }
inline void configTime(long, int, const char*, const char*) {}
struct SerialT { void begin(int) {} void println(const char* s) { (void)s; } template<class... A> void printf(const char* f, A... a) { (void)f; } };
extern SerialT Serial;
struct WiFiT { int status() { return g_wifi ? WL_CONNECTED : 0; } void begin(const char*, const char*) {} void mode(int) {} void setAutoReconnect(bool) {} void disconnect() {} int RSSI() { return -55; } };
extern WiFiT WiFi;
struct WiFiClient {};
#include <time.h>

// Minimal Arduino shim so Adafruit_GFX can render into a framebuffer on a computer.
#pragma once
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <math.h>
#include <algorithm>
#include <unistd.h>  // like the ESP32 core: catches names such as link() that clash with POSIX
typedef bool boolean;
typedef uint8_t byte;
#define PROGMEM
#define pgm_read_byte(a) (*(const uint8_t*)(a))
#define pgm_read_word(a) (*(const uint16_t*)(a))
#define pgm_read_dword(a) (*(const uint32_t*)(a))
#define pgm_read_pointer(a) (*(void* const*)(a))
using std::min; using std::max;
#ifndef _swap_int16_t
#define _swap_int16_t(a, b) { int16_t t = a; a = b; b = t; }
#endif
class __FlashStringHelper;
#define radians(d) ((d) * M_PI / 180.0)
class String { public: const char* c_str() const { return ""; } unsigned int length() const { return 0; } };
class Print {
 public:
  virtual ~Print() {}
  virtual size_t write(uint8_t) = 0;
  virtual size_t write(const uint8_t* b, size_t n) { size_t k = 0; while (n--) k += write(*b++); return k; }
  size_t print(const char* s) { return write((const uint8_t*)s, strlen(s)); }
};

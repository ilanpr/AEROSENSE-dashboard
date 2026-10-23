// Copy to config.h and adjust. config.h is not committed.
#pragma once

// Must match the node id the gateway and Supabase use.
#define NODE_ID "NODE_SIDOMORO_01"
#define SEND_INTERVAL_S 300            // LoRa packet every 5 minutes (GRU model expects 5 min)

// Local BAIK / WASPADA / BAHAYA for optical dust (µg/m³). Keep equal to the node rule
// (high, danger_high) set by the site manager so the screen and the dashboard agree.
#define DUST_WARNING 35.0
#define DUST_DANGER 55.0

// ---- Pins (ESP32-S3). Avoid GPIO 0, 3, 45, 46 (strapping) and 19, 20 (USB). ----
// SGP30 (I2C)
#define SGP_SDA 8
#define SGP_SCL 9
// AM2301 / DHT21 data
#define DHT_PIN 6
// Sharp GP2Y1010AU0F: LED drive pin and analog output (ADC1)
#define SHARP_LED_PIN 4
#define SHARP_LED_ACTIVE_LOW true     // typical wiring: pin LOW turns the IR LED on
#define SHARP_VO_PIN 1               // AEROSENSE PCB: Vo goes to GPIO 1 (ADC1)
#define SHARP_DIVIDER 1.0             // Vo/ADC ratio. No divider on the current PCB; 10k (top) + 20k (bottom) -> 1.5
#define SHARP_ZERO_V 0.60             // Vo in clean air; measure on site and update
// EBYTE E220 (UART, transparent mode: M0 and M1 to GND)
#define LORA_RX 17                    // ESP32 RX  <- module TXD
#define LORA_TX 18                    // ESP32 TX  -> module RXD
#define LORA_AUX -1                   // module AUX pin, or -1 if not wired
#define LORA_BAUD 9600
// TFT 1.8" ST7735 (pin on the module -> GPIO)
#define TFT_SCK 12                    // SCL
#define TFT_MOSI 11                   // SDA
#define TFT_CS 10                     // CS
#define TFT_DC 13                     // DC
#define TFT_RST 14                    // RES
#define TFT_BL 21                     // BL, or -1 if BL goes to 3V3
#define TFT_TAB INITR_BLACKTAB        // try INITR_GREENTAB if shifted, INITR_REDTAB if red/blue swapped
#define TFT_INVERT 0
#define TFT_ROTATION 0                // portrait 128x160; use 2 if the picture is upside down

// ---- Link quality ----
// The E220 in transparent mode cannot tell whether the gateway heard a packet. With ACK_MODE 1
// the node waits for "ACK,<node_id>,<counter>[,<rssi>]" from the gateway (see docs/SENSOR-NODE.md).
// With ACK_MODE 0 the screen shows "LORA TX" (packet sent, delivery unknown).
#define ACK_MODE 0
#define ACK_TIMEOUT_MS 2500
#define LORA_LOST_AFTER 3             // missed ACKs in a row before "LORA PUTUS"
#define LORA_WEAK_BELOW -105          // RSSI (dBm) below this is "LEMAH"

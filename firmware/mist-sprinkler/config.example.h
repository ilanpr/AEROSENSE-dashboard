// Copy this file to config.h and fill in the values. config.h is not committed.
#pragma once

// Must equal actuator_id in the n8n pairing and the MQTT username (lowercase, digits, '-').
#define ACTUATOR_ID "mist-01"

#define WIFI_SSID "nama-wifi"
#define WIFI_PASSWORD "password-wifi"

// LAN IP of the Ubuntu server running aerosense-mqtt, and the password printed by setup-mqtt.sh.
#define MQTT_HOST "192.168.1.10"
#define MQTT_PORT 1883
#define MQTT_PASSWORD "isi-dari-credentials.env"

// Relay or MOSFET driver input. Many relay modules switch ON with LOW (active-low).
#define RELAY_PIN 26
#define RELAY_ACTIVE_LOW true

// Optional physical OFF switch to GND (INPUT_PULLUP). Closed switch = output forced OFF. -1 = not fitted.
#define MANUAL_OFF_PIN 27
// Optional water/float sensor. -1 = not fitted (then no dry-run protection for the pump).
#define WATER_OK_PIN 25
#define WATER_OK_LEVEL HIGH

// Built-in LED mirrors the output so the first tests can run with the pump disconnected.
#define STATUS_LED_PIN 2

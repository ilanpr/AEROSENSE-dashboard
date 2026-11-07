#pragma once
#define ACTUATOR_ID "mist-01"
#define WIFI_SSID "ISI_WIFI_2G4"
#define WIFI_PASSWORD "ISI_PASSWORD_WIFI"
#define MQTT_HOST "172.16.0.84"
#define MQTT_PORT 1883
#define MQTT_PASSWORD "ISI_PASSWORD_MIST_01"
// Matches the working WATERSENSE_tes.ino supplied by the team.
#define PUMP_PIN 4
#define BATTERY_PIN 1
#define BUTTON_PIN 21
#define PUMP_ACTIVE_HIGH true
#define BATTERY_RATIO 5.0f
#define BATTERY_STOP_V 9.9f
#define BATTERY_RESUME_V 10.8f
#define LOCAL_PULSE_MS 10000
// Optional float switch. No GPIO is assigned unless the hardware is actually fitted.
#define WATER_OK_PIN -1
#define WATER_OK_LEVEL HIGH

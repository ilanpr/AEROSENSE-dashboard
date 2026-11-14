#pragma once
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

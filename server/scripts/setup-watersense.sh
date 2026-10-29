#!/usr/bin/env bash
# Run on the Ubuntu host that already runs n8n. No password is printed.
set -euo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
actuator="${1:-mist-01}"
[[ "$actuator" =~ ^[a-z0-9-]{1,40}$ ]] || { echo 'ID tidak valid'; exit 1; }
lan_ip="${MQTT_LAN_IP:-}"
if [[ -z "$lan_ip" ]]; then
 lan_ip="$(ip -4 -o addr show scope global | awk '$2 ~ /^(en|eth|wl)/ {split($4,a,"/");if(a[1] ~ /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/){print a[1];exit}}')"
fi
[[ "$lan_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'IP LAN belum ditemukan. Jalankan: MQTT_LAN_IP=IP_SERVER bash server/scripts/setup-watersense.sh mist-01';exit 1; }
# Bind only to the device LAN address. Docker n8n uses the internal network, not this port.
export MQTT_BIND="$lan_ip" MQTT_PRINT_CREDENTIALS=0
bash "$repo/server/scripts/setup-mqtt.sh" "$actuator"
printf '\nIsi config.h ESP32:\n  ACTUATOR_ID = %s\n  MQTT_HOST = %s\n  MQTT_PORT = 1883\n' "$actuator" "$lan_ip"
printf 'n8n MQTT credential: host aerosense-mqtt, port 1883, username n8n-aerosense.\n'
printf 'Password tersimpan lokal di ~/aerosense-mqtt/credentials.env. Jangan kirim isinya ke chat.\n'
printf 'Reservasi IP %s di router agar alamat broker tetap.\n' "$lan_ip"

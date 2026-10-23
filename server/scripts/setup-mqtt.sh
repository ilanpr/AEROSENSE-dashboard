#!/usr/bin/env bash
# Installs the authenticated Mosquitto broker for AEROSENSE actuators.
# Usage: bash server/scripts/setup-mqtt.sh mist-01 [mist-02 ...]
# Creates (or keeps) passwords for n8n and each actuator, prints new ones once,
# and stores them in ~/aerosense-mqtt/credentials.env (mode 600).
set -euo pipefail
umask 077
repo="$(cd "$(dirname "$0")/../.." && pwd)"
home="${MQTT_HOME:-$HOME/aerosense-mqtt}"
image="eclipse-mosquitto:2.0.20"
[[ $# -ge 1 ]] || { echo "Usage: bash server/scripts/setup-mqtt.sh ACTUATOR_ID [ACTUATOR_ID ...]" >&2; exit 1; }
for id in "$@"; do
  [[ "$id" =~ ^[a-z0-9-]{1,40}$ ]] || { echo "actuator_id tidak valid: $id (pakai huruf kecil, angka, dan tanda -)" >&2; exit 1; }
  [[ "$id" != "n8n-aerosense" ]] || { echo "Nama n8n-aerosense dipakai n8n." >&2; exit 1; }
done
docker network inspect n8n_default >/dev/null 2>&1 || { echo "Network Docker n8n_default tidak ditemukan. Pastikan n8n berjalan." >&2; exit 1; }
mkdir -p "$home/config" "$home/data"
cp "$repo/deploy/mqtt/mosquitto.conf" "$repo/deploy/mqtt/acl" "$home/config/"
creds="$home/credentials.env"
touch "$creds"
new_users=()
for user in n8n-aerosense "$@"; do
  key="MQTT_PASSWORD_$(echo "$user" | tr 'a-z-' 'A-Z_')"
  if ! grep -q "^$key=" "$creds"; then
    echo "$key=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 28)" >> "$creds"
    new_users+=("$user")
  fi
done
# Rebuild the password file from credentials.env inside the broker image (hashing + ownership).
args=()
while IFS='=' read -r key value; do
  [[ "$key" == MQTT_PASSWORD_* ]] || continue
  user="$(echo "${key#MQTT_PASSWORD_}" | tr 'A-Z_' 'a-z-')"
  args+=("$user" "$value")
done < "$creds"
docker run --rm -i -v "$home/config:/mosquitto/config" "$image" sh -s "${args[@]}" <<'SH'
set -e
rm -f /mosquitto/config/passwd
touch /mosquitto/config/passwd
while [ "$#" -ge 2 ]; do mosquitto_passwd -b /mosquitto/config/passwd "$1" "$2"; shift 2; done
chown -R mosquitto:mosquitto /mosquitto/config /mosquitto/data
chmod 0700 /mosquitto/config/passwd /mosquitto/config/acl
SH
MQTT_HOME="$home" docker compose -f "$repo/deploy/mqtt/compose.yaml" up -d
sleep 2
docker compose -f "$repo/deploy/mqtt/compose.yaml" ps
echo
echo "Broker berjalan. Host untuk n8n: aerosense-mqtt port 1883. Host untuk ESP32: IP LAN server ini port 1883."
{ ip -4 -o addr show scope global 2>/dev/null | awk '{print "  IP server: " $4}'; } || true
if [[ ${#new_users[@]} -gt 0 ]]; then
  echo
  echo "Password baru (simpan sekarang; juga tersimpan di $creds):"
  for user in "${new_users[@]}"; do
    key="MQTT_PASSWORD_$(echo "$user" | tr 'a-z-' 'A-Z_')"
    echo "  $user = $(grep "^$key=" "$creds" | cut -d= -f2-)"
  done
fi

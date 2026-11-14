#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

broker=aerosense-mqtt
config=/mosquitto/config/mosquitto.conf
baseline=$(git show c3553a0:deploy/mqtt/mosquitto.conf)
installed=$(docker exec "$broker" cat "$config")
if [[ "$installed" != "$baseline" && "$installed" != "$(cat deploy/mqtt/mosquitto.conf)" ]]; then
  echo "Konfigurasi broker berbeda dari versi AEROSENSE. Periksa perubahan lokal sebelum memasang WSS." >&2
  exit 1
fi

docker compose build web
backup=$(mktemp -d)
trap 'rm -f "$backup/mosquitto.conf"; rmdir "$backup"' EXIT
docker cp "$broker:$config" "$backup/mosquitto.conf"
docker cp deploy/mqtt/mosquitto.conf "$broker:/tmp/watersense-mosquitto.conf"
docker exec -i -u 0 "$broker" sh -se <<'SH'
cd /mosquitto/config
sed '/^n8n-aerosense:/d' passwd > device-passwd.new
test -s device-passwd.new
chown mosquitto:mosquitto device-passwd.new
chmod 0700 device-passwd.new
mv device-passwd.new device-passwd
cat /tmp/watersense-mosquitto.conf > mosquitto.conf
SH

listener_ready() {
  docker exec "$broker" sh -c 'awk '\''$4 == "0A" && $2 ~ /:2329$/ { ws=1 }
    $4 == "0A" && $2 ~ /:075B$/ { mqtt=1 } END { exit !(ws && mqtt) }'\'' /proc/net/tcp*'
}
if ! docker restart "$broker" || ! (for _ in {1..8}; do listener_ready && exit 0; sleep 1; done; exit 1); then
  echo "Listener WSS gagal. Memulihkan konfigurasi MQTT sebelumnya." >&2
  docker logs --tail 15 "$broker" >&2 || true
  docker cp "$backup/mosquitto.conf" "$broker:$config"
  docker restart "$broker"
  exit 1
fi

docker compose up -d --no-build web
curl --fail --max-time 5 --retry 5 --retry-delay 1 --retry-all-errors http://127.0.0.1:8082/api/health

status=$(curl --silent --http1.1 --max-time 3 --output /dev/null --write-out '%{http_code}' \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Sec-WebSocket-Protocol: mqtt' \
  http://127.0.0.1:8082/mqtt || true)
printf '\nMQTT WebSocket lokal: HTTP %s\n' "$status"
[[ "$status" == 101 ]]

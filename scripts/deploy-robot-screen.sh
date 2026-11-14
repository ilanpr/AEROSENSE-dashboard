#!/usr/bin/env bash
set -euo pipefail
umask 077
web="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backend="$HOME/aerosense-api"
if [[ ! -f "$backend/.env" || ! -f "$backend/api/server.mjs" ]]; then
  echo 'Instalasi API ~/aerosense-api tidak ditemukan. Source belum diubah.' >&2
  exit 1
fi
backup="$backend/face-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
files=(api/server.mjs api/browser-voice.mjs api/core.mjs)
for file in api/robot-face-relay.mjs api/voice-templates.mjs api/nodes.mjs api/deployment-revision.json; do
  if [[ -f "$backend/$file" ]]; then files+=("$file"); fi
done
tar -czf "$backup" -C "$backend" "${files[@]}"
cp "$web/server/api/server.mjs" "$web/server/api/core.mjs" "$web/server/api/robot-face-relay.mjs" "$web/server/api/browser-voice.mjs" "$web/server/api/voice-templates.mjs" "$web/server/api/nodes.mjs" "$backend/api/"
printf '{"commit":"%s"}\n' "$(git -C "$web" rev-parse HEAD)" > "$backend/api/deployment-revision.json"
cd "$backend"
if ! docker compose up -d --build aerosense-api || ! bash "$web/server/scripts/wait-api.sh"; then
  tar -xzf "$backup" -C "$backend"
  docker compose up -d --build aerosense-api
  echo 'API gagal diperbarui; source sebelumnya dipulihkan.' >&2
  exit 1
fi
status="$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:8080/v1/robot-face/status)"
[[ "$status" == 401 ]] || { echo "Pemeriksaan akses API gagal: HTTP $status" >&2; exit 1; }
cd "$web"
docker compose up -d --build web
curl --fail --retry 5 --retry-connrefused --retry-delay 2 http://127.0.0.1:8082/api/health
status="$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:8082/api/v1/robot-face/status)"
[[ "$status" == 401 ]] || { echo "Pemeriksaan proxy wajah gagal: HTTP $status" >&2; exit 1; }
printf '\nLayar: https://aerosense.me/robot-screen\nBackup: %s\n' "$backup"

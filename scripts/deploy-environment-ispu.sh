#!/usr/bin/env bash
set -euo pipefail

web="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backend="$HOME/aerosense-api"
target="$backend/api/environment-insights.mjs"
backup="$(mktemp "$backend/ispu-backup.XXXXXX")"
cp "$target" "$backup"
cp "$web/server/api/environment-insights.mjs" "$target"

cd "$backend"
if ! docker compose up -d --build aerosense-api || ! bash "$web/server/scripts/wait-api.sh"; then
  cp "$backup" "$target"
  docker compose up -d --build aerosense-api
  echo 'Pembaruan API gagal. Versi sebelumnya dipulihkan.' >&2
  exit 1
fi

cd "$web"
docker compose up -d --build web
bash server/scripts/wait-api.sh http://127.0.0.1:8082/api/health
git rev-parse --short HEAD

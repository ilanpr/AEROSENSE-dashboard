#!/usr/bin/env bash
set -euo pipefail
umask 077
revision="${1:-}"
if [[ ! "$revision" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'Usage: bash deploy-update.sh COMMIT_SHA' >&2
  exit 1
fi
target="$HOME/aerosense-api"
if [[ ! -d "$target/api" || ! -f "$target/.env" ]]; then
  echo 'Folder ~/aerosense-api atau .env tidak ditemukan. Hentikan dan periksa lokasi pemasangan.' >&2
  exit 1
fi
staging="$(mktemp -d /tmp/aerosense-update.XXXXXXXX)"
curl --fail --location --retry 2 --connect-timeout 15 --max-time 180 \
  "https://codeload.github.com/ilanpr/AEROSENSE-dashboard/tar.gz/$revision" -o "$staging/source.tar.gz"
tar -xzf "$staging/source.tar.gz" -C "$staging"
source_dir="$staging/AEROSENSE-dashboard-$revision/server"
test -f "$source_dir/api/environment-events.mjs"
backup="$HOME/aerosense-api-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$backup" -C "$target" .env api scripts Dockerfile package.json package-lock.json
cp -a "$source_dir/api/." "$target/api/"
cp -a "$source_dir/scripts/." "$target/scripts/"
cp "$source_dir/Dockerfile" "$source_dir/package.json" "$source_dir/package-lock.json" "$target/"
printf '{"commit":"%s"}\n' "$revision" > "$target/api/deployment-revision.json"
cd "$target"
# Keep the existing Compose network, ports, credentials and volumes.
docker compose up -d --build aerosense-api
curl --retry 15 --retry-connrefused --retry-delay 2 --fail --show-error http://127.0.0.1:8080/health
printf '\n'
docker compose exec -T aerosense-api node scripts/check-db.mjs
docker compose exec -T aerosense-api node scripts/check-environment.mjs
printf '\nBackup lokal: %s\n' "$backup"

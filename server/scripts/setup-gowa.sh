#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$HOME/aerosense-api"
mode="${1:-}"
if [[ "$mode" != install && "$mode" != resume && "$mode" != bind && "$mode" != check ]]; then
  echo 'Usage: bash scripts/setup-gowa.sh install|resume|bind|check' >&2; exit 1
fi
test -f .env
test -f compose.gowa.yaml
put_env() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp .env.tmp.XXXXXXXX)"
  awk -v key="$key" -v value="$value" 'BEGIN {found=0} index($0,key"=")==1 {if(!found) print key"="value; found=1; next} {print} END {if(!found) print key"="value}' .env > "$tmp"
  mv "$tmp" .env
}
if [[ "$mode" == install ]]; then
  cp -p .env ".env.backup-gowa-$(date +%Y%m%d-%H%M%S)"
  if [[ ! -f .env.gowa ]]; then
    printf 'GOWA_BASIC_AUTH=aerosense:%s\nGOWA_WEBHOOK_SECRET=%s\n' "$(openssl rand -hex 24)" "$(openssl rand -hex 32)" > .env.gowa
  fi
  chmod 600 .env .env.gowa
  # Only generated hexadecimal credentials are copied; never source the main .env.
  auth="$(sed -n 's/^GOWA_BASIC_AUTH=//p' .env.gowa)"
  secret="$(sed -n 's/^GOWA_WEBHOOK_SECRET=//p' .env.gowa)"
  [[ "$auth" =~ ^aerosense:[a-f0-9]{48}$ && "$secret" =~ ^[a-f0-9]{64}$ ]] || { echo 'Invalid generated GOWA credentials' >&2; exit 1; }
  put_env GOWA_BASIC_AUTH "$auth"
  put_env GOWA_WEBHOOK_SECRET "$secret"
  put_env GOWA_BASE_URL http://aerosense-gowa:3000
  put_env GOWA_DEVICE_ID aerosense
  docker compose --env-file .env.gowa -f compose.gowa.yaml -p aerosense-gowa up -d
  docker compose up -d --force-recreate aerosense-api
fi
if [[ "$mode" == install || "$mode" == resume ]]; then
  bash scripts/wait-api.sh
  auth="$(sed -n 's/^GOWA_BASIC_AUTH=//p' .env.gowa)"
  [[ "$auth" =~ ^aerosense:[a-f0-9]{48}$ ]] || { echo 'Invalid generated GOWA credentials' >&2; exit 1; }
  ready=false
  for attempt in {1..30}; do
    if curl --fail --silent --user "$auth" http://127.0.0.1:3001/devices > /dev/null; then ready=true; break; fi
    sleep 2
  done
  [[ "$ready" == true ]] || { echo 'GOWA is starting; check docker logs before retrying' >&2; exit 1; }
  # Read the host script through stdin so recovery does not require rebuilding the image.
  docker compose exec -T aerosense-api node --input-type=module < scripts/ensure-gowa-device.mjs
  printf '\nGOWA ready on Ubuntu loopback port 3001. Credentials are in ~/aerosense-api/.env.gowa.\n'
  printf 'Open through SSH port forwarding, select device aerosense and scan its QR. Then run: bash scripts/setup-gowa.sh bind\n'
elif [[ "$mode" == bind ]]; then
  docker compose exec -T aerosense-api node scripts/check-gowa.mjs
  jid="$(docker compose exec -T aerosense-api node scripts/check-gowa.mjs --jid)"
  [[ "$jid" =~ ^[0-9]{8,15}@s\.whatsapp\.net$ ]] || exit 1
  cp -p .env ".env.backup-bind-$(date +%Y%m%d-%H%M%S)"
  put_env GOWA_DEVICE_JID "$jid"
  put_env WHATSAPP_PROVIDER gowa
  docker compose up -d --force-recreate aerosense-api
  bash scripts/wait-api.sh
  docker compose exec -T aerosense-api node scripts/check-gowa.mjs
else
  docker compose exec -T aerosense-api node scripts/check-gowa.mjs
fi

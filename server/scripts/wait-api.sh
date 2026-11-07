#!/usr/bin/env bash
set -euo pipefail
url="${1:-http://127.0.0.1:8080/health}"
attempts="${2:-30}"
[[ "$attempts" =~ ^[1-9][0-9]?$ && "$attempts" -le 30 ]] || exit 2
for ((attempt=1; attempt<=attempts; attempt++)); do
  if response="$(curl --fail --silent --connect-timeout 2 --max-time 5 "$url")" && \
      [[ "$response" =~ \"status\"[[:space:]]*:[[:space:]]*\"ok\" ]]; then
    printf '%s\n' "$response"
    exit 0
  fi
  if ((attempt < attempts)); then sleep 2; fi
done
echo 'API belum siap. Periksa: docker compose logs --tail=80 aerosense-api' >&2
exit 1

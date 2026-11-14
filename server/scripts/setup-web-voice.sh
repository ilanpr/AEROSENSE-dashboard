#!/usr/bin/env bash
set -euo pipefail
umask 077
target="$HOME/aerosense-api"
test -f "$target/.env" || { echo 'Folder ~/aerosense-api/.env tidak ditemukan.' >&2; exit 1; }
command -v python3 >/dev/null || { echo 'Python 3 diperlukan pada Ubuntu.' >&2; exit 1; }
n8n_container="$(docker ps --filter label=com.docker.compose.service=n8n --format '{{.ID}}' | head -n 1)"
test -n "$n8n_container" || { echo 'Container n8n aktif tidak ditemukan.' >&2; exit 1; }
credential_path="/tmp/aerosense-voice-credentials-$$.json"
staging="$(mktemp /tmp/aerosense-voice.XXXXXXXX)"
cleanup() { docker exec "$n8n_container" rm -f "$credential_path" >/dev/null 2>&1 || true; rm -f "$staging"; }
trap cleanup EXIT
# Export only inside the user's server. Never echo credentials or commit them.
docker exec "$n8n_container" sh -c 'umask 077; n8n export:credentials --all --decrypted --output="$1"' sh "$credential_path" >/dev/null
docker exec "$n8n_container" cat "$credential_path" > "$staging"
python3 - "$target/.env" "$staging" <<'PY'
import json, os, pathlib, sys, datetime
env_path, export_path = map(pathlib.Path, sys.argv[1:])
credentials = json.loads(export_path.read_text())
candidates = [c for c in credentials if c.get('type') == 'googlePalmApi' and isinstance(c.get('data'), dict) and c['data'].get('apiKey')]
if len(candidates) > 1:
    candidates = [c for c in candidates if 'aerosense' in c.get('name', '').lower()]
if len(candidates) != 1:
    raise SystemExit('Credential Gemini tidak ditemukan secara unik. Pilih credential Gemini AEROSENSE di n8n sebelum melanjutkan; jangan kirim key ke chat.')
original = env_path.read_text()
existing = dict(line.split('=', 1) for line in original.splitlines() if '=' in line and not line.lstrip().startswith('#'))
values = {
    'GEMINI_API_KEY': existing.get('GEMINI_API_KEY') or candidates[0]['data']['apiKey'],
    'GEMINI_TEXT_MODEL': existing.get('GEMINI_TEXT_MODEL') or 'gemini-3.5-flash-lite',
    'GEMINI_TRANSCRIBE_MODEL': existing.get('GEMINI_TRANSCRIBE_MODEL') or 'gemini-3.5-flash-lite',
    'GEMINI_TTS_MODEL': existing.get('GEMINI_TTS_MODEL') or 'gemini-3.8-flash-tts',
    'GEMINI_TTS_VOICE': existing.get('GEMINI_TTS_VOICE') or 'Puck',
}
if any('\n' in str(value) or '\r' in str(value) for value in values.values()):
    raise SystemExit('Format konfigurasi tidak valid.')
backup = env_path.with_name('.env.before-voice-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.write_text(original)
os.chmod(backup, 0o600)
lines = [line for line in original.splitlines() if line.partition('=')[0] not in values]
temp_path = env_path.with_name('.env.voice-tmp')
temp_path.write_text('\n'.join(lines + [key + '=' + str(value) for key, value in values.items()]) + '\n')
os.chmod(temp_path, 0o600)
os.replace(temp_path, env_path)
print('Konfigurasi suara tersimpan. Key tidak ditampilkan. Backup .env dibuat di server.')
PY
cd "$target"
docker compose up -d --force-recreate aerosense-api
bash scripts/wait-api.sh
docker compose exec -T aerosense-api node -e 'console.log(JSON.stringify({gemini_key_configured:!!process.env.GEMINI_API_KEY,text_model:process.env.GEMINI_TEXT_MODEL,tts_model:process.env.GEMINI_TTS_MODEL,tts_voice:process.env.GEMINI_TTS_VOICE}))'

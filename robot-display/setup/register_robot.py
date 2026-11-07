import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def run(args, cwd):
    return subprocess.run(args, cwd=cwd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True).stdout


def register(data):
    robot, node, key = data["robot_id"], data["node_id"], data["key"]
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", robot + "") or not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", node):
        raise ValueError("Invalid device identity")
    if not re.fullmatch(r"[a-f0-9]{64}", key):
        raise ValueError("Invalid device key")
    candidates = [Path.home() / name for name in ("aerosense-api", "aerosense-backend")]
    candidates = [p for p in candidates if (p / ".env").is_file() and any((p / f).is_file() for f in ("compose.yaml", "docker-compose.yml", "docker-compose.yaml"))]
    if len(candidates) != 1:
        raise ValueError("Cannot identify the backend folder")
    folder = candidates[0]
    code = "console.log(JSON.stringify(Object.fromEntries(['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','DEVICE_KEYS_JSON'].map(k=>[k,process.env[k]]))))"
    config = json.loads(run(["docker", "compose", "exec", "-T", "aerosense-api", "node", "-e", code], folder))
    keys = json.loads(config["DEVICE_KEYS_JSON"])
    if robot in keys and keys[robot] != {"type": "robot", "key": key}:
        raise ValueError("Device ID already has another credential; existing key was preserved")
    headers = {"apikey": config["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": "Bearer " + config["SUPABASE_SERVICE_ROLE_KEY"], "Content-Type": "application/json"}

    def database(route, body=None):
        request = urllib.request.Request(config["SUPABASE_URL"].rstrip("/") + "/rest/v1/" + route, headers=headers, data=None if body is None else json.dumps(body).encode())
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read()
            return json.loads(raw) if raw else None

    if not database("ae_nodes?id=eq." + node + "&enabled=eq.true&select=id"):
        raise ValueError("The assigned sensor node is missing or disabled")
    existing = database("ae_robots?id=eq." + robot + "&select=id,node_id,enabled")
    if existing and (existing[0]["node_id"] != node or not existing[0]["enabled"]):
        raise ValueError("Robot already exists with another assignment or is disabled")
    if not existing:
        database("ae_robots", {"id": robot, "node_id": node, "enabled": True, "quiet": False, "presence_cooldown_seconds": 120})
    keys[robot] = {"type": "robot", "key": key}
    env = folder / ".env"
    backup = folder / (".env.before-robot-" + time.strftime("%Y%m%d-%H%M%S"))
    shutil.copy2(env, backup)
    os.chmod(backup, 0o600)
    lines = env.read_text().splitlines()
    replacement = "DEVICE_KEYS_JSON=" + json.dumps(keys, separators=(",", ":"))
    found = False
    for index, line in enumerate(lines):
        if line.startswith("DEVICE_KEYS_JSON="):
            lines[index] = replacement
            found = True
    if not found:
        raise ValueError("DEVICE_KEYS_JSON is not defined in the existing .env")
    env.write_text("\n".join(lines) + "\n")
    os.chmod(env, 0o600)
    try:
        run(["docker", "compose", "up", "-d", "--force-recreate", "aerosense-api"], folder)
        status = None
        for _ in range(30):
            request = urllib.request.Request("http://127.0.0.1:8080/v1/robot/audio/00000000-0000-0000-0000-000000000000", headers={"x-device-id": robot, "x-device-key": key})
            try:
                with urllib.request.urlopen(request, timeout=2) as response:
                    status = response.status
            except urllib.error.HTTPError as error:
                status = error.code
            except OSError:
                status = None
            if status in (200, 404):
                break
            time.sleep(1)
        if status not in (200, 404):
            raise ValueError("The backend did not accept the new device credential")
    except Exception:
        shutil.copy2(backup, env)
        run(["docker", "compose", "up", "-d", "--force-recreate", "aerosense-api"], folder)
        raise
    print(json.dumps({"registered": True, "robot_id": robot, "node_id": node}))


if __name__ == "__main__":
    try:
        register(json.load(sys.stdin))
    except Exception as error:
        print("Registration failed: " + str(error), file=sys.stderr)
        sys.exit(1)

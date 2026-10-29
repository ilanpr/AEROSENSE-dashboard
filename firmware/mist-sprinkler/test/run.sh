#!/usr/bin/env bash
# Host-side safety test of the sprinkler firmware (no ESP32 needed). Requires g++ and git.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
git -c advice.detachedHead=false clone -q --depth 1 --branch v7.2.1 https://github.com/bblanchon/ArduinoJson.git "$work/ArduinoJson"
cp "$here/../config.example.h" "$work/config.h"
g++ -std=c++17 -Wall -Wextra -Wno-unused-parameter -I"$work" -I"$here/mock" -I"$work/ArduinoJson/src" -I"$here/.." "$here/sim.cpp" -o "$work/sim"
"$work/sim"

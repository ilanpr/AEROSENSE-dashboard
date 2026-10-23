#!/usr/bin/env bash
# Renders the display screens to PNG on a computer using the real Adafruit GFX code.
# Requires g++, git and python3 with Pillow. Output: firmware/tft-display/test/out/*.png
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
git -c advice.detachedHead=false clone -q --depth 1 --branch v7.2.1 https://github.com/bblanchon/ArduinoJson.git "$work/json"
git -c advice.detachedHead=false clone -q --depth 1 https://github.com/adafruit/Adafruit-GFX-Library.git "$work/gfx"
g++ -std=c++17 -DARDUINO=200 -DARDUINOJSON_ENABLE_ARDUINO_STRING=0 -DARDUINOJSON_ENABLE_ARDUINO_STREAM=0 \
  -DARDUINOJSON_ENABLE_ARDUINO_PRINT=0 -DARDUINOJSON_ENABLE_PROGMEM=0 -Wall -Wno-unused-function \
  -I"$here/shim" -I"$work/gfx" -I"$work/json/src" -I"$here/.." "$here/preview.cpp" "$work/gfx/Adafruit_GFX.cpp" -o "$work/preview"
mkdir -p "$here/out"
"$work/preview" "$here/out"
python3 -c "import sys,glob; from PIL import Image; [Image.open(p).resize((480,384),Image.NEAREST).save(p[:-4]+'.png') for p in glob.glob(sys.argv[1]+'/*.ppm')]" "$here/out"
rm -f "$here/out"/*.ppm
echo "PNG di $here/out"

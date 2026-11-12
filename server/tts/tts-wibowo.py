import hashlib
import hmac
import io
import json
import os
import re
import shutil
import sys
import threading
import urllib.request
import zipfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

REVISION = "9e8dbdc46d95d78e20c5cd750e6b63ed3c3abfb3"
MODEL_NAME = "checkpoint_1260000-inference.pth"
CACHE = Path(os.environ.get("LOCALAPPDATA", Path.home() / ".cache")) / "Aerosense" / "wibowo"
SOURCE = CACHE / f"TTS-Indonesia-Gratis-{REVISION}"


def download(url, destination, digest):
    if destination.exists():
        with destination.open("rb") as current:
            if hashlib.file_digest(current, "sha256").hexdigest() == digest:
                return
    part = destination.with_suffix(".part")
    try:
        with urllib.request.urlopen(url, timeout=60) as response, part.open("wb") as output:
            shutil.copyfileobj(response, output)
        with part.open("rb") as downloaded:
            if hashlib.file_digest(downloaded, "sha256").hexdigest() != digest:
                raise RuntimeError(f"Checksum mismatch: {destination.name}")
        part.replace(destination)
    finally:
        part.unlink(missing_ok=True)


def prepare():
    CACHE.mkdir(parents=True, exist_ok=True)
    archive = CACHE / "drat-source.zip"
    download(
        f"https://codeload.github.com/drat/TTS-Indonesia-Gratis/zip/{REVISION}",
        archive,
        "367c364df126f497898c339404e76abfaff2481fd41b365d6fe91099d78ba523",
    )
    with zipfile.ZipFile(archive) as source:
        source.extractall(CACHE)
    download(
        f"https://github.com/Wikidepia/indonesian-tts/releases/download/v1.2/{MODEL_NAME}",
        CACHE / MODEL_NAME,
        "399e41d1e2a704056b96b82692dd7d0fa3cc351ea20d277f534f7a656522eb74",
    )


def load_voice():
    if not SOURCE.is_dir() or not (CACHE / MODEL_NAME).is_file():
        raise RuntimeError("Run tts-wibowo.py --prepare first")
    sys.path.insert(0, str(SOURCE))
    import torch
    from g2p_id import G2P
    from g2p_id.scripts.terbilang import terbilang
    from TTS.utils.synthesizer import Synthesizer

    torch.set_num_threads(min(4, os.cpu_count() or 1))
    data = SOURCE / "g2p_id" / "data"
    config = json.loads((data / "config.json").read_text(encoding="utf-8"))
    speakers = str(data / "speakers.pth")
    config["speakers_file"] = config["model_args"]["speakers_file"] = speakers
    config_file = CACHE / "config.json"
    config_file.write_text(json.dumps(config), encoding="utf-8")
    voice = Synthesizer(
        tts_checkpoint=str(CACHE / MODEL_NAME), tts_config_path=str(config_file), use_cuda=False
    )
    pronounce = G2P()

    def number(match):
        whole, separator, decimal = match[0].replace(",", ".").partition(".")
        words = terbilang(int(whole))
        if separator:
            words += " koma " + " ".join(terbilang(int(digit)) for digit in decimal)
        return words

    def speak(text):
        text = re.sub(r"\baero[\s-]*bot\b", "aero bot", text, flags=re.I)
        text = re.sub(r"\b\d+(?:[.,]\d+)?", number, text)
        text = text.replace("%", " persen").replace(":", ",")
        samples = voice.tts(pronounce(text), speaker_name="wibowo")
        output = io.BytesIO()
        voice.save_wav(samples, output)
        return output.getvalue()

    return speak


def stop_on_parent_exit():
    os.read(sys.stdin.fileno(), 1)
    os._exit(0)


def serve():
    key = os.environ.get("AEROBOT_LOCAL_TTS_KEY", "")
    if not key:
        raise RuntimeError("Set AEROBOT_LOCAL_TTS_KEY before starting the local service")
    speak = load_voice()
    if sys.argv[1:] == ["--managed"]:
        threading.Thread(target=stop_on_parent_exit, daemon=True).start()

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            if self.path != "/speak" or self.headers.get("Origin"):
                self.send_error(403)
                return
            if not hmac.compare_digest(self.headers.get("X-Local-TTS-Key", "").encode(), key.encode()):
                self.send_error(401)
                return
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= 16000:
                    raise ValueError("Invalid body size")
                body = json.loads(self.rfile.read(size))
                text = body.get("text") if isinstance(body, dict) else None
                if not isinstance(text, str) or not text.strip() or len(text) > 2000:
                    raise ValueError("Invalid text")
            except ValueError:
                self.send_error(400)
                return
            try:
                audio = speak(text.strip())
            except Exception as error:
                print(f"Wibowo synthesis failed: {type(error).__name__}", file=sys.stderr, flush=True)
                self.send_error(503)
                return
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(audio)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                self.wfile.write(audio)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def log_message(self, *_args):
            pass

    # Mini PC: localhost only. Server container: AEROBOT_TTS_HOST=0.0.0.0 on the internal Docker network.
    host = os.environ.get("AEROBOT_TTS_HOST", "127.0.0.1")
    with HTTPServer((host, 4220), Handler) as server:
        print(f"Wibowo ready at http://{host}:4220/speak", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    if sys.argv[1:] == ["--prepare"]:
        prepare()
    else:
        serve()

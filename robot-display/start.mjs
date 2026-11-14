import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";
import { launchLiveBrowser } from "./live-browser.mjs";
import { expressionFor } from "./screen/expression.js";
import { createPresence } from "./presence.mjs";
import { readIr, listIrPorts } from "./ir-serial.mjs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "screen");
try {
  process.loadEnvFile(path.join(here, ".env.local"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const ttsPython = process.env.AEROBOT_TTS_PYTHON;
const ttsUrl = process.env.AEROBOT_LOCAL_TTS_URL || (ttsPython ? "http://127.0.0.1:4220/speak" : "");
const ttsKey = process.env.AEROBOT_LOCAL_TTS_KEY || (ttsPython ? randomUUID() : "");
let ttsProcess;
const port = Number(process.env.AEROBOT_DISPLAY_PORT || 4210),
  host = "127.0.0.1",
  origin = `http://${host}:${port}`,
  clients = new Set();
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid local display port");
const api = (process.env.AEROSENSE_API_URL || "https://aerosense.me/api").replace(/\/$/, "");
const device = process.env.AEROBOT_DEVICE_ID,
  key = process.env.AEROBOT_DEVICE_KEY;
const headers = {
  "x-device-id": device || "",
  "x-device-key": key || "",
  "Content-Type": "application/json",
};
let state = { action: "sleep" },
  pending = null,
  pendingAt = 0,
  polling = false,
  closed = false,
  browserSession;
const presence = createPresence();
let voiceBusyUntil = 0;
let irReader = null,
  lastIrSample = null,
  lastIrAt = 0,
  presenceEvent = null;
function connectIr(portName) {
  irReader?.kill();
  const reader = readIr(
    portName,
    (sample) => {
      lastIrAt = Date.now();
      if (!sample.ready) return;
      if (lastIrSample !== sample.detected)
        console.log(
          `[IR] OUT=${sample.raw} ${sample.detected ? "objek terdeteksi" : "tidak ada objek"}`,
        );
      lastIrSample = sample.detected;
      const action = presence.update(
        sample.detected,
        Date.now(),
        !!pending || Date.now() < voiceBusyUntil,
      );
      if (!action) return;
      emit({ action });
      if (action === "wake") queuePresence();
    },
    () => {
      if (irReader === reader) {
        irReader = null;
        lastIrSample = null;
        console.log("[IR] Koneksi terputus; status tidak diketahui.");
      }
    },
  );
  irReader = reader;
  console.log("[IR] Membaca " + portName + " pada 115200 baud.");
}
function queuePresence() {
  if (device && key)
    presenceEvent = { event_id: "ir-" + randomUUID(), type: "presence", created: Date.now() };
}
async function sendPresence() {
  if (!presenceEvent) return;
  if (Date.now() - presenceEvent.created > 30000) {
    presenceEvent = null;
    console.error("[IR] Event kedaluwarsa sebelum diterima API.");
    return;
  }
  const event = presenceEvent;
  await remote("/v1/robot/event", {
    method: "POST",
    body: JSON.stringify({ type: event.type, event_id: event.event_id }),
  });
  if (presenceEvent === event) presenceEvent = null;
  console.log("[API] Presence diterima; menunggu perintah robot dari n8n.");
}
const completed = new Set();
const queuedAcks = new Map();
function emit(event) {
  if (["speak", "thinking"].includes(event.action)) voiceBusyUntil = Date.now() + 150000;
  if (["speak", "expression"].includes(event.action))
    event = { ...event, emotion: expressionFor(event.text, event.severity, event.emotion) };
  state = event;
  for (const client of clients) client.write(`data: ${JSON.stringify(event)}\n\n`);
  console.log(`[face] ${event.action}${event.emotion ? " / " + event.emotion : ""}`);
}
async function remote(endpoint, options = {}) {
  const r = await fetch(api + endpoint, {
    ...options,
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`AEROSENSE returned ${r.status}`);
  return r;
}
async function localSpeech(text) {
  const target = new URL(ttsUrl);
  if (target.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(target.hostname))
    throw new Error("Local TTS must run on this mini PC");
  if (typeof text !== "string" || !text.trim() || text.length > 2000)
    throw new Error("Invalid local speech text");
  const reply = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Local-TTS-Key": ttsKey,
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(45000),
  });
  if (!reply.ok) throw new Error("Local speech unavailable");
  const audio = Buffer.from(await reply.arrayBuffer());
  if (
    audio.length > 12000000 ||
    audio.toString("ascii", 0, 4) !== "RIFF" ||
    audio.toString("ascii", 8, 12) !== "WAVE"
  )
    throw new Error("Invalid local WAV");
  return audio;
}
async function flushAcks() {
  for (const [id, result] of queuedAcks) {
    await remote("/v1/robot/ack", { method: "POST", body: JSON.stringify({ id, state: result }) });
    queuedAcks.delete(id);
    completed.add(id);
    if (completed.size > 100) completed.delete(completed.values().next().value);
  }
}
async function acknowledge(id, result) {
  if (!pending || pending.id !== id) return false;
  pending = null;
  queuedAcks.set(id, result);
  await flushAcks();
  return true;
}
const server = http.createServer(async (req, res) => {
  try {
    if (
      req.headers.host !== `${host}:${port}` ||
      (req.headers.origin && req.headers.origin !== origin)
    ) {
      res.writeHead(403);
      return res.end();
    }
    const url = new URL(req.url, origin);
    if (url.pathname === "/tts" && req.method === "POST") {
      if (!ttsUrl || !ttsKey) {
        res.writeHead(503);
        return res.end("Local TTS is not enabled");
      }
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 16000) {
          res.writeHead(413);
          return res.end();
        }
      }
      let text;
      try {
        text = JSON.parse(raw).text;
      } catch {
        res.writeHead(400);
        return res.end();
      }
      if (typeof text !== "string" || !text.trim() || text.length > 2000) {
        res.writeHead(400);
        return res.end();
      }
      let audio;
      try {
        audio = await localSpeech(text);
      } catch {
        res.writeHead(503);
        return res.end("Local speech unavailable");
      }
      res.writeHead(200, { "Content-Type": "audio/wav", "Cache-Control": "no-store" });
      return res.end(audio);
    }
    if (url.pathname === "/activity" && req.method === "POST") {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 1000) {
          res.writeHead(413);
          return res.end();
        }
      }
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        res.writeHead(400);
        return res.end();
      }
      if (!["sleeping", "waking", "listening", "thinking", "speaking"].includes(body.mode)) {
        res.writeHead(400);
        return res.end();
      }
      voiceBusyUntil = ["thinking", "speaking"].includes(body.mode) ? Date.now() + 150000 : 0;
      res.writeHead(204);
      return res.end();
    }
    if (url.pathname === "/events") {
      if (req.method !== "GET") {
        res.writeHead(405);
        return res.end();
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      });
      clients.add(res);
      // Never replay in-progress speech when a window reconnects.
      res.write(
        `data: ${JSON.stringify(state.action === "speak" ? { action: "listening" } : state)}\n\n`,
      );
      const pulse = setInterval(() => res.write(": keepalive\n\n"), 20000);
      req.on("close", () => {
        clearInterval(pulse);
        clients.delete(res);
        if (!clients.size && pending) {
          state = { action: "listening" };
          void acknowledge(pending.id, "failed").catch((error) =>
            console.error("[ack retry queued]", error.message),
          );
        }
      });
      return;
    }
    if (url.pathname === "/ack" && req.method === "POST") {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 1000) {
          res.writeHead(413);
          return res.end();
        }
      }
      const body = JSON.parse(raw);
      if (!["done", "failed"].includes(body.state)) {
        res.writeHead(400);
        return res.end();
      }
      await acknowledge(body.id, body.state);
      res.writeHead(204);
      return res.end();
    }
    if (req.method !== "GET") {
      res.writeHead(405);
      return res.end();
    }
    const name = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
      file = path.resolve(root, "." + name);
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    const body = await fs.readFile(file);
    const type =
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".svg": "image/svg+xml",
      }[path.extname(file)] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(body);
  } catch (error) {
    res.writeHead(error.code === "ENOENT" ? 404 : 500);
    res.end("Request could not be completed");
  }
});
async function poll() {
  if (closed || polling || !device || !key) return;
  polling = true;
  try {
    await flushAcks();
    if (pending && Date.now() - pendingAt > 110000) {
      const id = pending.id;
      emit({ action: "stop" });
      await acknowledge(id, "failed");
    }
    if (pending || clients.size === 0) return;
    await sendPresence();
    const { commands } = await (await remote("/v1/robot/commands")).json();
    for (const command of commands || []) {
      if (completed.has(command.id)) continue;
      const body = command.body || {};
      if (Date.parse(command.expires_at) < Date.now() || body.muted === true) {
        pending = command;
        await acknowledge(command.id, "failed");
        continue;
      }
      if (body.action === "listen") {
        emit({ action: "listening" });
        pending = command;
        console.log(
          "[face-only] Microphone capture is not implemented; listen command is not acknowledged as executed.",
        );
        await acknowledge(command.id, "failed");
        continue;
      }
      if (body.action !== "speak") {
        pending = command;
        await acknowledge(command.id, "failed");
        continue;
      }
      pending = command;
      pendingAt = Date.now();
      emit({ action: "thinking" });
      let bytes;
      try {
        if (!body.audio_path) throw new Error("Cloud audio is missing");
        const reply = await remote("/v1/robot/audio/" + encodeURIComponent(command.id));
        if (!reply.headers.get("content-type")?.startsWith("audio/"))
          throw new Error("Audio response was invalid");
        bytes = Buffer.from(await reply.arrayBuffer());
      } catch (error) {
        if (!ttsUrl || !ttsKey) throw error;
        bytes = await localSpeech(body.text);
      }
      if (bytes.length > 12000000) throw new Error("Audio exceeds local limit");
      emit({
        action: "speak",
        commandId: command.id,
        text: String(body.text || "").slice(0, 4000),
        emotion: body.expression || body.face,
        severity: body.severity,
        audioBase64: bytes.toString("base64"),
        mime: "audio/wav",
      });
      break;
    }
  } catch (error) {
    console.error("[connection]", error.message);
    if (pending) {
      try {
        await acknowledge(pending.id, "failed");
      } catch {
        pending = null;
      }
    }
  } finally {
    polling = false;
  }
}
server.listen(port, host, async () => {
  if (ttsPython && !process.env.AEROBOT_LOCAL_TTS_URL) {
    ttsProcess = spawn(ttsPython, [path.join(here, "tts-wibowo.py"), "--managed"], {
      env: { ...process.env, AEROBOT_LOCAL_TTS_KEY: ttsKey },
      stdio: ["pipe", "inherit", "inherit"],
      windowsHide: true,
    });
    ttsProcess.on("error", (error) => console.error("[Wibowo]", error.message));
  }
  console.log(`AERO-BOT physical face: ${origin}`);
  console.log(
    device && key
      ? "Device adapter enabled. Commands will be claimed only while this screen is connected."
      : process.env.AEROBOT_OPEN_WINDOW === "0"
        ? "Local replay mode."
        : "Live web mode. Sign in to the AEROSENSE chat window opened by this app.",
  );
  console.log(
    "Commands: wake | sleep | think | neutral | happy | concerned | warning | danger | surprised | say TEXT | play PATH | TEXT | ports | ir COM5",
  );
  if (process.env.AEROBOT_IR_PORT) connectIr(process.env.AEROBOT_IR_PORT);
  if (process.env.AEROBOT_OPEN_WINDOW !== "0") {
    const candidates =
      process.platform === "win32"
        ? [
            "C:/Program Files/Google/Chrome/Application/chrome.exe",
            "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
          ]
        : process.platform === "darwin"
          ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
          : ["/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/chromium-browser"];
    for (const browser of candidates) {
      try {
        await fs.access(browser);
        browserSession = launchLiveBrowser(
          browser,
          path.join(here, ".chrome-profile-studio"),
          origin,
          (event) => {
            if (!pending) emit(event);
          },
        );
        break;
      } catch {}
    }
  }
});
const interval = setInterval(() => {
  if (lastIrSample !== null && Date.now() - lastIrAt > 3000) {
    lastIrSample = null;
    console.log("[IR] Tidak ada data baru; status tidak diketahui.");
  }
  void poll();
}, 1400);
const input = readline.createInterface({ input: process.stdin, output: process.stdout });
input.on("line", async (line) => {
  const value = line.trim();
  if (value === "presence") {
    if (pending) return;
    console.log("[IR] Pemicu presence manual, bukan pembacaan sensor.");
    emit({ action: "wake" });
    queuePresence();
    return;
  }
  if (value === "ports") {
    listIrPorts();
    return;
  }
  if (value.startsWith("ir ")) {
    connectIr(value.slice(3).trim());
    return;
  }
  if (pending) {
    console.log("Tunggu sampai jawaban robot selesai.");
    return;
  }
  if (["wake", "sleep", "thinking", "think", "stop"].includes(value)) {
    emit({ action: value === "think" ? "thinking" : value });
    return;
  }
  if (["neutral", "happy", "concerned", "warning", "danger", "surprised"].includes(value)) {
    emit({ action: "expression", emotion: value });
    return;
  }
  if (value.startsWith("play ")) {
    const [file, text = "Halo, saya AERO-BOT."] = value.slice(5).split("|");
    try {
      const audio = await fs.readFile(file.trim().replace(/^"|"$/g, ""));
      if (audio.length > 12000000) throw new Error("Maximum audio size: 12 MB");
      emit({
        action: "speak",
        text,
        audioBase64: audio.toString("base64"),
        mime: file.trim().toLowerCase().endsWith(".mp3") ? "audio/mpeg" : "audio/wav",
      });
    } catch (error) {
      console.log(error.message);
    }
    return;
  }
  if (!value) return;
  const text = value.replace(/^say /, "");
  if (ttsUrl && ttsKey) {
    try {
      const wav = await localSpeech(text);
      if (!pending) {
        emit({ action: "speak", text, audioBase64: wav.toString("base64"), mime: "audio/wav" });
      }
    } catch (error) {
      console.error("[Wibowo]", error.message);
    }
  } else {
    emit({ action: "speak", local: true, text });
  }
});
function close() {
  closed = true;
  irReader?.kill();
  ttsProcess?.stdin.end();
  browserSession?.close();
  clearInterval(interval);
  for (const client of clients) client.end();
  input.close();
  server.close();
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    close();
    process.exit(0);
  });
}

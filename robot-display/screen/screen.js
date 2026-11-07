import { MOODS, clamp, expressionFor, poseFor, parts } from "./expression.js";
import { envelopeAt } from "./timeline.js";
const character = document.querySelector("#character"),
  notice = document.querySelector("#notice"),
  caption = document.querySelector("#caption");
if (window.aerobotArtwork) {
  character.innerHTML = window.aerobotArtwork;
} else {
  const artwork = await fetch("./face.svg");
  if (!artwork.ok) throw new Error("Gambar wajah tidak dapat dimuat");
  character.innerHTML = await artwork.text();
}
const svg = character.querySelector("svg"),
  nodes = Object.fromEntries([...svg.querySelectorAll("[id]")].map((n) => [n.id, n]));
const reduced = matchMedia("(prefers-reduced-motion:reduce)");
let mode = "sleeping",
  mood = "neutral",
  started = performance.now(),
  previous = started,
  pose = poseFor(mode, mood, 0),
  volume = 0;
let timeline = null;
let audio = null,
  context = null,
  disconnect = () => {},
  speech = null,
  token = 0,
  wakeTimer = 0,
  demoTimer = 0,
  muted = false,
  monitor = false;
const state = () => ({
  mode,
  mood,
  volume,
  playbackTime: audio?.currentTime ?? null,
  source: monitor ? "web-audio" : "local",
});
function setMode(value) {
  mode = value;
  started = performance.now();
  document.body.dataset.mode = mode;
  if (location.pathname === "/" || location.pathname === "/index.html")
    void fetch("/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: value }),
    }).catch(() => {});
}
function setMood(value) {
  mood = MOODS.includes(value) ? value : "neutral";
  character.style.filter = `hue-rotate(${mood === "danger" ? 140 : mood === "warning" ? -165 : 0}deg) saturate(.98)`;
  document.body.dataset.mood = mood;
}
function audioContext() {
  context ??= new AudioContext();
  void context.resume();
  return context;
}
function stop() {
  ++token;
  clearTimeout(wakeTimer);
  clearTimeout(demoTimer);
  disconnect();
  disconnect = () => {};
  audio?.pause();
  audio = null;
  window.speechSynthesis?.cancel();
  speech = null;
  volume = 0;
  timeline = null;
  notice.textContent = "";
}
function sleeping() {
  stop();
  setMood("neutral");
  setMode("sleeping");
}
function wake() {
  stop();
  setMood("happy");
  setMode("waking");
  wakeTimer = setTimeout(() => setMode("listening"), 1900);
}
function analyserFor(player, silent) {
  const ctx = audioContext(),
    input = ctx.createMediaElementSource(player),
    analyser = ctx.createAnalyser(),
    gain = ctx.createGain();
  analyser.fftSize = 512;
  gain.gain.value = silent || muted ? 0 : 1;
  input.connect(analyser);
  analyser.connect(gain);
  gain.connect(ctx.destination);
  const buffer = new Float32Array(512);
  let frame = 0;
  function sample() {
    analyser.getFloatTimeDomainData(buffer);
    const rms = Math.sqrt(buffer.reduce((s, x) => s + x * x, 0) / buffer.length);
    volume = clamp(Math.sqrt(Math.max(0, rms - 0.004)) * 3.8);
    frame = requestAnimationFrame(sample);
  }
  sample();
  disconnect = () => {
    cancelAnimationFrame(frame);
    input.disconnect();
    analyser.disconnect();
    gain.disconnect();
    volume = 0;
  };
}
async function ack(id, status) {
  if (!id) return;
  try {
    await fetch("/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, state: status }),
    });
  } catch {
    notice.textContent = "Balasan selesai, tetapi konfirmasi belum terkirim.";
  }
}
async function speak(event) {
  stop();
  const run = token;
  monitor = event.monitorOnly === true;
  setMood(expressionFor(event.text, event.severity, event.emotion));
  setMode("thinking");
  caption.textContent = event.text || "";
  try {
    let source = event.audio;
    if (event.audioBase64) {
      const bytes = Uint8Array.from(atob(event.audioBase64), (c) => c.charCodeAt(0));
      source = new Blob([bytes], { type: event.mime || "audio/wav" });
    }
    if (source instanceof Blob) {
      const url = URL.createObjectURL(source);
      const player = new Audio(url);
      audio = player;
      analyserFor(player, monitor);
      const finish = async (failure) => {
        URL.revokeObjectURL(url);
        if (run !== token) return;
        disconnect();
        volume = 0;
        setMode("listening");
        if (failure) notice.textContent = "Audio belum dapat diputar. Tekan Spasi lalu coba lagi.";
        await ack(event.commandId, failure ? "failed" : "done");
      };
      player.onended = () => void finish(false);
      player.onerror = () => void finish(true);
      await player.play();
      if (run === token) setMode("speaking");
      return;
    }
    if (event.local === true && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(event.text || "Halo, saya AERO-BOT.");
      speech = utterance;
      utterance.lang = "id-ID";
      utterance.rate = 0.93;
      utterance.voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith("id")) || null;
      utterance.volume = muted ? 0 : 1;
      utterance.onstart = () => {
        if (run === token) setMode("speaking");
      };
      utterance.onend = () => {
        if (run === token) {
          volume = 0;
          speech = null;
          setMode("listening");
        }
      };
      utterance.onerror = () => {
        if (run === token) {
          volume = 0;
          speech = null;
          setMode("listening");
          notice.textContent =
            "Suara perangkat tidak tersedia. Gunakan rekaman atau suara AERO-BOT.";
        }
      };
      speechSynthesis.speak(utterance);
      return;
    }
    setMode("listening");
    notice.textContent = event.text ? "Jawaban diterima; audio belum tersedia." : "";
    await ack(event.commandId, "failed");
  } catch {
    if (run === token) {
      disconnect();
      setMode("listening");
      notice.textContent = "Klik layar untuk mengaktifkan audio, lalu coba lagi.";
      await ack(event.commandId, "failed");
    }
  }
}
function receive(event) {
  if (!event || typeof event !== "object") return;
  if (event.action === "speak") {
    if (event.envelope) {
      stop();
      setMood(expressionFor(event.text, event.severity, event.emotion));
      timeline = { ...event.envelope, startAt: event.localStartAt || Date.now() };
      setMode("thinking");
      return;
    }
    void speak(event);
    return;
  }
  if (event.action === "wake") {
    wake();
    return;
  }
  if (event.action === "sleep") {
    sleeping();
    return;
  }
  if (event.action === "stop") {
    stop();
    setMode("listening");
    return;
  }
  if (event.action === "thinking") {
    stop();
    setMood("neutral");
    setMode("thinking");
    return;
  }
  if (event.action === "expression") {
    stop();
    setMood(expressionFor(event.text, event.severity, event.emotion));
    setMode("listening");
    return;
  }
  if (event.action === "listening") {
    stop();
    setMode("listening");
  }
}
function frame(now) {
  const dt = Math.min(60, now - previous);
  previous = now;
  if (timeline) {
    const elapsed = Date.now() - timeline.startAt;
    volume = envelopeAt(timeline.values, timeline.frameMs, elapsed);
    if (elapsed >= 0 && mode !== "speaking") setMode("speaking");
    if (elapsed > timeline.durationMs) {
      timeline = null;
      volume = 0;
      setMode("listening");
    }
  }
  const amplitude =
    speech && mode === "speaking"
      ? clamp(0.35 + 0.3 * Math.sin(now * 0.019) + 0.2 * Math.sin(now * 0.032))
      : volume;
  const target = poseFor(mode, mood, (now - started) / 1000, amplitude, reduced.matches),
    mix = 1 - Math.exp(-dt / 75);
  for (const key of [
    "open",
    "smile",
    "wink",
    "sparkle",
    "brow",
    "browLift",
    "browAsym",
    "gaze",
    "beak",
    "tilt",
    "lift",
  ])
    pose[key] +=
      (target[key] - pose[key]) *
      (key.startsWith("brow")
        ? 1 - Math.exp(-dt / 150)
        : key === "beak"
          ? 1 - Math.exp(-dt / 35)
          : mix);
  for (const [id, attrs] of Object.entries(parts(pose)))
    for (const [key, value] of Object.entries(attrs)) nodes[id]?.setAttribute(key, value);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.body.dataset.mode = mode;
document.body.dataset.mood = mood;
window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  const key = event.key.toLowerCase();
  if (event.code === "Space") {
    event.preventDefault();
    if (mode === "sleeping") wake();
    else sleeping();
  }
  if (/^[1-6]$/.test(key)) {
    stop();
    setMood(MOODS[Number(key) - 1]);
    setMode("listening");
  }
  if (key === "t") {
    stop();
    setMode("thinking");
  }
  if (key === "f") {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  }
  if (key === "c")
    svg.setAttribute(
      "preserveAspectRatio",
      svg.getAttribute("preserveAspectRatio").includes("meet") ? "xMidYMid slice" : "xMidYMid meet",
    );
  if (key === "h") document.querySelector("#help").hidden = !document.querySelector("#help").hidden;
  if (key === "m") muted = !muted;
  if (key === "escape") {
    stop();
    setMode("listening");
    document.querySelector("#help").hidden = true;
  }
  if (key === "d") {
    wake();
    demoTimer = setTimeout(
      () =>
        void speak({
          local: true,
          text: "Halo! Senang bertemu dengan Anda. Saya AERO-BOT, siap membantu memahami kondisi udara.",
        }),
      2100,
    );
  }
  void audioContext()
    .resume()
    .catch(() => {});
});
document.addEventListener("pointerdown", () => {
  void audioContext()
    .resume()
    .catch(() => {});
});
if (!window.aerobotRemote && (location.pathname === "/" || location.port === "4210")) {
  const events = new EventSource("/events");
  events.onmessage = (event) => {
    try {
      receive(JSON.parse(event.data));
    } catch {}
  };
  events.onerror = () => {
    notice.textContent = "Pengendali belum terhubung. Mencoba kembali…";
  };
  events.onopen = () => {
    notice.textContent = "";
  };
}
window.aerobotDisplay = { receive, getState: state, unlockAudio: () => audioContext().resume() };

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const file = new URL("../../src/lib/handsfree-engine.ts", import.meta.url);
const helpers = new URL("../../src/lib/handsfree.ts", import.meta.url).href;
const source = fs.readFileSync(file, "utf8").replace('from "./handsfree"', `from "${helpers}"`);
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { createHandsFreeEngine } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);

function microphone() {
  let time = 0,
    processor,
    stopped = 0;
  const saved = new Map();
  function replace(target, name, value) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    saved.set(name, () =>
      descriptor ? Object.defineProperty(target, name, descriptor) : delete target[name],
    );
    Object.defineProperty(target, name, { configurable: true, value });
  }
  const node = () => ({
    gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    frequency: { value: 0 },
    connect() {
      return this;
    },
    disconnect() {},
    start() {},
    stop() {},
  });
  const track = {
    stop() {
      stopped++;
    },
  };
  replace(performance, "now", () => time);
  replace(
    globalThis,
    "AudioContext",
    class {
      state = "running";
      sampleRate = 16000;
      currentTime = 0;
      destination = {};
      createMediaStreamSource = node;
      createGain = node;
      createOscillator = node;
      createScriptProcessor() {
        processor = node();
        return processor;
      }
      async resume() {}
      async close() {}
    },
  );
  replace(
    globalThis,
    "Audio",
    class {
      load() {}
      pause() {}
      async play() {
        this.onplaying?.();
        queueMicrotask(() => this.onended?.());
      }
    },
  );
  replace(navigator, "mediaDevices", {
    async getUserMedia() {
      return { getTracks: () => [track], getAudioTracks: () => [track] };
    },
  });
  function feed(level, frames) {
    const samples = new Float32Array(320).fill(level);
    for (let i = 0; i < frames; i++) {
      time += 20;
      processor.onaudioprocess({ inputBuffer: { getChannelData: () => samples } });
    }
  }
  return {
    silence() {
      feed(0, 200);
    },
    async utterance(level = 0.12) {
      time += 3000;
      feed(level, 60);
      feed(0, 65);
      await new Promise(setImmediate);
    },
    get stopped() {
      return stopped;
    },
    restore() {
      for (const restore of saved.values()) restore();
    },
  };
}

test("Gemini wake accepts audio, ignores silence, and requires a fresh call for every chat turn", async () => {
  const mic = microphone(),
    questions = [];
  const transcripts = [
    "Bagaimana cuaca?",
    "Halo AERO-BOT, bagaimana udara?",
    "Bagaimana cuacanya?",
    "Halo AERO-BOT",
    "Bagaimana kualitas udara?",
  ];
  let calls = 0,
    speechAvailable = true;
  const playedMoods = [];
  const engine = createHandsFreeEngine({
    async transcribe(type, base64, signal) {
      assert.equal(type, "audio/wav");
      assert.equal(Buffer.from(base64, "base64").toString("ascii", 0, 4), "RIFF");
      assert.equal(signal.aborted, false);
      return transcripts[calls++];
    },
    async fetchSpeech() {
      if (!speechAvailable) throw new Error("429 TTS quota exceeded");
      return new Blob([new Uint8Array(44)], { type: "audio/wav" });
    },
    async onQuestion(text) {
      questions.push(text);
      return true;
    },
    onState() {},
    onPlayback(audio, _text, emotion) {
      if (audio) playedMoods.push(emotion);
    },
  });
  try {
    await engine.start();
    assert.equal(engine.state.engine, "gemini");
    mic.silence();
    assert.equal(calls, 0);
    await mic.utterance();
    assert.equal(calls, 1);
    assert.equal(questions.length, 0);
    await mic.utterance();
    assert.deepEqual(questions, ["bagaimana udara?"]);
    await engine.speakAnswer("job", "Udara tersedia.", "concerned");
    assert.deepEqual(playedMoods, ["concerned"]);
    assert.equal(engine.state.phase, "waiting");
    await mic.utterance();
    assert.equal(questions.length, 1);
    await mic.utterance();
    assert.equal(engine.state.phase, "listening");
    await mic.utterance();
    assert.equal(questions.length, 2);
    assert.equal(questions[1], "Bagaimana kualitas udara?");
    speechAvailable = false;
    await engine.speakAnswer("job-2", "Udara tersedia.");
    assert.equal(engine.state.phase, "waiting");
    assert.match(engine.state.error, /Suara AERO-BOT belum tersedia/);
    transcripts.push("Halo AERO-BOT bagaimana tanah?");
    await mic.utterance();
    assert.equal(questions[2], "bagaimana tanah?");
    assert.equal(mic.stopped, 0);
  } finally {
    engine.stop();
    assert.equal(mic.stopped, 1);
    mic.restore();
  }
});

test("the latest utterance is kept while a previous wake transcription is pending", async () => {
  const mic = microphone(),
    questions = [];
  let calls = 0,
    finishFirst,
    queuedPeak;
  const engine = createHandsFreeEngine({
    async transcribe(_type, base64) {
      if (++calls === 1)
        return new Promise((resolve) => {
          finishFirst = resolve;
        });
      const wav = Buffer.from(base64, "base64");
      queuedPeak = 0;
      for (let i = 44; i < wav.length; i += 2)
        queuedPeak = Math.max(queuedPeak, Math.abs(wav.readInt16LE(i)) / 32767);
      return "Halo AERO-BOT bagaimana udara?";
    },
    async fetchSpeech() {
      throw new Error("Unexpected TTS call");
    },
    async onQuestion(text) {
      questions.push(text);
      return true;
    },
    onState() {},
  });
  try {
    await engine.start();
    await mic.utterance();
    await mic.utterance(0.2);
    await mic.utterance(0.3);
    assert.equal(calls, 1);
    finishFirst("Percakapan sekitar.");
    await new Promise(setImmediate);
    assert.equal(calls, 2);
    assert.ok(Math.abs(queuedPeak - 0.3) < 0.001);
    assert.deepEqual(questions, ["bagaimana udara?"]);
  } finally {
    engine.stop();
    mic.restore();
  }
});

test("failed wake transcription is visible and stopping cancels an in-flight request", async () => {
  const mic = microphone();
  let calls = 0,
    questions = 0,
    activeSignal;
  const engine = createHandsFreeEngine({
    async transcribe(_type, _audio, signal) {
      if (++calls === 1) throw new Error("AERO-BOT sedang sibuk.");
      activeSignal = signal;
      return new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }),
      );
    },
    async fetchSpeech() {
      throw new Error("Unexpected TTS call");
    },
    async onQuestion() {
      questions++;
      return true;
    },
    onState() {},
  });
  try {
    await engine.start();
    await mic.utterance();
    assert.equal(engine.state.phase, "waiting");
    assert.match(engine.state.error, /sibuk/);
    await mic.utterance();
    assert.equal(activeSignal.aborted, false);
    engine.stop();
    assert.equal(activeSignal.aborted, true);
    await new Promise(setImmediate);
    assert.equal(engine.state.phase, "off");
    assert.equal(questions, 0);
  } finally {
    engine.stop();
    mic.restore();
  }
});

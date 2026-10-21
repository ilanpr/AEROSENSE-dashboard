// Hands-free AERO-BOT: listens for "Halo AERO-BOT", detects when the speaker stops,
// sends the question automatically and plays the answer without any button press.
// Audio stays in memory. Only the spoken question segment is sent for transcription.
import {
  answerChunks, concatFrames, createVad, detectWakePhrase, downsample, encodeWav, hasQuestion, rms, speechChunks, toBase64,
} from "./handsfree";

export type HandsFreePhase = "off" | "starting" | "blocked" | "waiting" | "listening" | "transcribing" | "thinking" | "speaking";
export type WakeEngine = "browser" | "gemini";

export interface HandsFreeState {
  phase: HandsFreePhase;
  level: number;
  engine: WakeEngine;
  heard: string;
  notice: string;
  error: string;
  followUp: boolean;
}

export interface HandsFreeCallbacks {
  transcribe(mimeType: string, base64: string): Promise<string>;
  fetchSpeech(jobId: string, part: number, signal: AbortSignal): Promise<Blob>;
  onQuestion(text: string): Promise<boolean>;
  onState(state: HandsFreeState): void;
}

export interface HandsFreeEngine {
  start(): Promise<void>;
  resume(): Promise<void>;
  stop(): void;
  speakAnswer(jobId: string, text: string): Promise<void>;
  announce(text: string): Promise<void>;
  stopSpeaking(): void;
  readonly state: HandsFreeState;
}

interface RecognitionAlternative { transcript: string }
interface RecognitionResult { readonly isFinal: boolean; readonly length: number; [index: number]: RecognitionAlternative }
interface RecognitionEvent { readonly resultIndex: number; readonly results: { readonly length: number; [index: number]: RecognitionResult } }
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;

const TARGET_RATE = 16000;
const PRE_ROLL_MS = 450;
const LISTEN_TIMEOUT_MS = 9000;
const FOLLOW_UP_MS = 8000;
const WAKE_GRACE_MS = 1600;
const MAX_QUESTION_MS = 20000;
const MAX_IDLE_SEGMENT_MS = 12000;
const END_SILENCE_MS = 1100;
// Speech shorter than this after the wake word means only "Halo AERO-BOT" was said.
const WAKE_ONLY_MS = 1700;

const workletSource = `
class AerosenseMicTap extends AudioWorkletProcessor {
  constructor() { super(); this.buffer = new Float32Array(Math.round(sampleRate * 0.02)); this.size = 0; }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) for (let i = 0; i < channel.length; i++) {
      this.buffer[this.size++] = channel[i];
      if (this.size === this.buffer.length) { this.port.postMessage(this.buffer.slice(0)); this.size = 0; }
    }
    return true;
  }
}
registerProcessor("aerosense-mic-tap", AerosenseMicTap);
`;

export function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

export function createHandsFreeEngine(callbacks: HandsFreeCallbacks): HandsFreeEngine {
  let state: HandsFreeState = { phase: "off", level: 0, engine: "gemini", heard: "", notice: "", error: "", followUp: false };
  let run = 0;
  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  let nodes: AudioNode[] = [];
  let recognition: Recognition | null = null;
  let recognitionWanted = false;
  let recognitionFailures = 0;
  const vad = createVad({ maxSpeechMs: MAX_QUESTION_MS, endSilenceMs: END_SILENCE_MS });
  let preRoll: Float32Array[] = [];
  let preRollMs = 0;
  let segment: Float32Array[] | null = null;
  let segmentStartedAt = 0;
  let segmentWake = false;
  let pendingSegment: { frames: Float32Array[]; rate: number; duration: number; startedAt: number } | null = null;
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  let wakeLatched = false;
  let browserRemainder = "";
  let browserFinals: { at: number; text: string }[] = [];
  let ignoreUntil = 0;
  let listenTimer: ReturnType<typeof setTimeout> | undefined;
  let frameCount = 0;
  let lastIdleTranscription = 0;
  let transcribing = false;
  let speechController: AbortController | null = null;
  let player: HTMLAudioElement | null = null;
  let playerUrl: string | null = null;
  let finishSpeech: (() => void) | null = null;
  let thinkingTimer: ReturnType<typeof setInterval> | undefined;

  const now = () => performance.now();
  function set(patch: Partial<HandsFreeState>) {
    state = { ...state, ...patch };
    callbacks.onState(state);
  }

  function clearSegment() {
    segment = null;
    segmentWake = false;
    pendingSegment = null;
    clearTimeout(pendingTimer);
    preRoll = [];
    preRollMs = 0;
    vad.reset();
  }

  function enterWaiting(notice = "") {
    clearTimeout(listenTimer);
    clearInterval(thinkingTimer);
    clearSegment();
    wakeLatched = false;
    browserRemainder = "";
    ignoreUntil = now() + 300;
    set({ phase: "waiting", notice, followUp: false });
  }

  function enterListening(timeout: number, followUp: boolean, notice = "") {
    clearTimeout(listenTimer);
    clearSegment();
    ignoreUntil = now() + 380;
    set({ phase: "listening", followUp, notice });
    const token = run;
    listenTimer = setTimeout(() => {
      if (token !== run || state.phase !== "listening" || segment) return;
      earcon("timeout");
      enterWaiting();
    }, timeout);
  }

  function earcon(kind: "wake" | "sent" | "timeout" | "tick") {
    if (!context || context.state !== "running") return;
    const tones = kind === "wake" ? [660, 880] : kind === "sent" ? [740] : kind === "tick" ? [600] : [520, 390];
    const volume = kind === "tick" ? 0.05 : 0.18;
    const start = context.currentTime + 0.02;
    tones.forEach((frequency, index) => {
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      const at = start + index * 0.13;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
      oscillator.connect(gain).connect(context!.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.12);
    });
    ignoreUntil = Math.max(ignoreUntil, now() + tones.length * 130 + 250);
  }

  function pushPreRoll(frame: Float32Array, frameMs: number) {
    preRoll.push(frame);
    preRollMs += frameMs;
    while (preRollMs > PRE_ROLL_MS && preRoll.length > 1) {
      const dropped = preRoll.shift()!;
      preRollMs -= (dropped.length / (context?.sampleRate || 48000)) * 1000;
    }
  }

  function onFrame(frame: Float32Array) {
    if (!context) return;
    const level = rms(frame);
    const frameMs = (frame.length / context.sampleRate) * 1000;
    if (++frameCount % 5 === 0) set({ level: Math.min(1, level * 14) });
    if (state.phase !== "waiting" && state.phase !== "listening") return;
    if (now() < ignoreUntil) return;
    if (segment) segment.push(frame);
    else pushPreRoll(frame, frameMs);
    const event = vad.push(level, frameMs);
    if (event === "start") {
      segment = preRoll;
      preRoll = [];
      preRollMs = 0;
      segmentStartedAt = now() - PRE_ROLL_MS;
      segmentWake = wakeLatched;
      clearTimeout(listenTimer);
    } else if (event === "end" && segment) {
      const frames = segment;
      const duration = Math.max(0, now() - segmentStartedAt - PRE_ROLL_MS - END_SILENCE_MS);
      const startedAt = segmentStartedAt;
      const woke = segmentWake;
      segment = null;
      segmentWake = false;
      void handleSegment(frames, context.sampleRate, duration, startedAt, woke);
    }
  }

  async function transcribeFrames(frames: Float32Array[], rate: number, startedAt: number): Promise<string> {
    const wav = encodeWav(downsample(concatFrames(frames), rate, TARGET_RATE), TARGET_RATE);
    transcribing = true;
    try {
      return (await callbacks.transcribe("audio/wav", toBase64(wav))).trim();
    } catch (error) {
      // Gemini busy or unreachable: use what the browser recognizer heard for the same moment.
      const fallback = browserFinals.filter(item => item.at >= startedAt - 300).map(item => item.text).join(" ").trim();
      if (fallback) return fallback;
      throw error;
    } finally {
      transcribing = false;
    }
  }

  async function handleSegment(frames: Float32Array[], rate: number, duration: number, startedAt: number, woke: boolean) {
    if (duration < 200) return; // clicks and short noises
    const token = run;
    if (state.phase === "waiting") {
      if (state.engine === "browser") {
        if (woke) return processWakeSegment(frames, rate, duration, startedAt);
        // Browser results can arrive slightly after silence. Keep the segment briefly.
        pendingSegment = { frames, rate, duration, startedAt };
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => { pendingSegment = null; }, WAKE_GRACE_MS);
        return;
      }
      if (transcribing || duration > MAX_IDLE_SEGMENT_MS || now() - lastIdleTranscription < 2500) return;
      lastIdleTranscription = now();
      let text = "";
      try { text = await transcribeFrames(frames, rate, startedAt); } catch { return; }
      if (token !== run || state.phase !== "waiting") return;
      const wake = detectWakePhrase(text);
      if (!wake.matched) return;
      return afterWake(wake.remainder);
    }
    if (state.phase === "listening") {
      set({ phase: "transcribing", notice: "" });
      let text = "";
      try {
        text = await transcribeFrames(frames, rate, startedAt);
      } catch (error) {
        if (token !== run) return;
        const message = error instanceof Error ? error.message : "Suara belum terbaca.";
        set({ error: message });
        await say(/sibuk/i.test(message) ? "Maaf, layanan sedang sibuk. Silakan ulangi pertanyaan Anda." : "Maaf, suara belum terdengar jelas. Silakan ulangi.");
        if (token === run) enterListening(LISTEN_TIMEOUT_MS, true);
        return;
      }
      if (token !== run) return;
      const wake = detectWakePhrase(text);
      const question = wake.matched ? wake.remainder : text;
      if (!hasQuestion(question)) {
        if (wake.matched) { earcon("wake"); enterListening(LISTEN_TIMEOUT_MS, false); return; }
        await say("Maaf, belum terdengar jelas. Silakan ulangi.");
        if (token === run) enterListening(LISTEN_TIMEOUT_MS, true);
        return;
      }
      return ask(question);
    }
  }

  async function processWakeSegment(frames: Float32Array[], rate: number, duration: number, startedAt: number) {
    const token = run;
    // Only "Halo AERO-BOT" was said: skip a transcription call and listen for the question.
    if (!hasQuestion(browserRemainder) && duration < WAKE_ONLY_MS) {
      earcon("wake");
      enterListening(LISTEN_TIMEOUT_MS, false);
      return;
    }
    set({ phase: "transcribing", notice: "" });
    let text = "";
    try { text = await transcribeFrames(frames, rate, startedAt); } catch { text = ""; }
    if (token !== run) return;
    const wake = detectWakePhrase(text);
    const question = wake.matched ? wake.remainder : hasQuestion(browserRemainder) ? browserRemainder : text;
    if (hasQuestion(question)) return ask(question);
    earcon("wake");
    enterListening(LISTEN_TIMEOUT_MS, false);
  }

  function afterWake(remainder: string) {
    if (hasQuestion(remainder)) return ask(remainder);
    earcon("wake");
    enterListening(LISTEN_TIMEOUT_MS, false);
  }

  async function ask(question: string) {
    const token = run;
    clearTimeout(listenTimer);
    set({ phase: "thinking", heard: question, error: "", notice: "" });
    earcon("sent");
    // Short spoken acknowledgement plus a soft tick so silence never feels like a hang.
    void say("Baik, sebentar ya.", true);
    clearInterval(thinkingTimer);
    thinkingTimer = setInterval(() => {
      if (token !== run || state.phase !== "thinking") { clearInterval(thinkingTimer); return; }
      earcon("tick");
    }, 2500);
    let sent = false;
    try { sent = await callbacks.onQuestion(question); } catch { sent = false; }
    if (token !== run) return;
    if (!sent) {
      await say("Pertanyaan belum terkirim. Silakan coba lagi.");
      if (token === run) enterWaiting();
    }
  }

  function onBrowserWake(remainder: string) {
    browserRemainder = remainder;
    if (wakeLatched) return;
    wakeLatched = true;
    if (segment) { segmentWake = true; return; }
    if (pendingSegment) {
      const pending = pendingSegment;
      pendingSegment = null;
      clearTimeout(pendingTimer);
      void processWakeSegment(pending.frames, pending.rate, pending.duration, pending.startedAt);
      return;
    }
    earcon("wake");
    enterListening(LISTEN_TIMEOUT_MS, false);
  }

  function startRecognition() {
    const Constructor = recognitionConstructor();
    if (!Constructor) { set({ engine: "gemini" }); return; }
    const token = run;
    const instance = new Constructor();
    instance.lang = "id-ID";
    instance.continuous = true;
    instance.interimResults = true;
    instance.maxAlternatives = 3;
    instance.onresult = event => {
      if (token !== run) return;
      recognitionFailures = 0;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal && result[0]?.transcript) {
          browserFinals.push({ at: now(), text: result[0].transcript });
          browserFinals = browserFinals.filter(item => now() - item.at < 30000);
        }
        if (state.phase !== "waiting" && !(wakeLatched && state.phase === "listening")) continue;
        for (let alt = 0; alt < result.length; alt++) {
          const wake = detectWakePhrase(result[alt].transcript);
          if (wake.matched) { onBrowserWake(wake.remainder); break; }
        }
      }
    };
    instance.onerror = event => {
      if (token !== run) return;
      if (["not-allowed", "service-not-allowed", "language-not-supported"].includes(event.error)) recognitionFailures = 99;
      else if (event.error === "network" || event.error === "audio-capture") recognitionFailures++;
      if (recognitionFailures >= 3) {
        recognitionWanted = false;
        set({ engine: "gemini", notice: "AERO-BOT sedang mendengarkan. Ucapkan “Halo AERO-BOT” lalu sampaikan pertanyaan Anda." });
      }
    };
    instance.onend = () => {
      if (token !== run || !recognitionWanted) return;
      setTimeout(() => {
        if (token !== run || !recognitionWanted) return;
        try { instance.start(); } catch { /* already started */ }
      }, recognitionFailures ? 1200 * recognitionFailures : 250);
    };
    recognition = instance;
    recognitionWanted = true;
    set({ engine: "browser" });
    try { instance.start(); } catch { recognitionWanted = false; set({ engine: "gemini" }); }
  }

  async function setupAudio(media: MediaStream) {
    const audio = new AudioContext();
    context = audio;
    const source = audio.createMediaStreamSource(media);
    const sink = audio.createGain();
    sink.gain.value = 0;
    let tap: AudioNode;
    if (audio.audioWorklet) {
      const url = URL.createObjectURL(new Blob([workletSource], { type: "application/javascript" }));
      try { await audio.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
      const worklet = new AudioWorkletNode(audio, "aerosense-mic-tap", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: "explicit" });
      worklet.port.onmessage = event => onFrame(event.data as Float32Array);
      tap = worklet;
    } else {
      const processor = audio.createScriptProcessor(1024, 1, 1);
      processor.onaudioprocess = event => onFrame(new Float32Array(event.inputBuffer.getChannelData(0)));
      tap = processor;
    }
    source.connect(tap);
    tap.connect(sink);
    sink.connect(audio.destination);
    nodes = [source, tap, sink];
  }

  async function start() {
    if (state.phase !== "off") return;
    const token = ++run;
    set({ phase: "starting", error: "", notice: "", heard: "" });
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: false,
      });
      if (token !== run) { media.getTracks().forEach(track => track.stop()); return; }
      stream = media;
      media.getAudioTracks().forEach(track => {
        track.onended = () => { if (token === run) { stop(); set({ error: "Mikrofon terputus. Sambungkan lagi lalu aktifkan mode suara." }); } };
      });
      await setupAudio(media);
      if (token !== run) return;
      if (typeof speechSynthesis !== "undefined") speechSynthesis.getVoices();
      if (context!.state !== "running") await context!.resume().catch(() => undefined);
      if (context!.state !== "running") { set({ phase: "blocked" }); return; }
      goLive();
    } catch (error) {
      if (token !== run) return;
      stop();
      set({
        error: error instanceof DOMException && error.name === "NotAllowedError"
          ? "Izin mikrofon ditolak. Izinkan mikrofon di pengaturan situs, lalu aktifkan lagi."
          : error instanceof Error ? error.message : "Mikrofon belum tersedia.",
      });
    }
  }

  function goLive() {
    if (!recognition) startRecognition();
    enterWaiting();
  }

  async function resume() {
    if (!context || state.phase !== "blocked") return;
    await context.resume().catch(() => undefined);
    if (context?.state === "running" && state.phase === "blocked") goLive();
  }

  function releaseSpeech() {
    speechController?.abort();
    speechController = null;
    player?.pause();
    player = null;
    if (playerUrl) URL.revokeObjectURL(playerUrl);
    playerUrl = null;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    const finish = finishSpeech;
    finishSpeech = null;
    finish?.();
  }

  function say(text: string, quiet = false): Promise<void> {
    if (typeof speechSynthesis === "undefined" || !text.trim()) return Promise.resolve();
    return new Promise(resolve => {
      const previous = state.phase;
      if (!quiet) set({ phase: "speaking" });
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (state.phase === "speaking" && previous !== "speaking") set({ phase: previous });
        resolve();
      };
      finishSpeech = finish;
      const voices = speechSynthesis.getVoices();
      const voice = voices.find(item => item.lang.toLowerCase().startsWith("id")) || null;
      const chunks = speechChunks(text);
      chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.lang = "id-ID";
        if (voice) utterance.voice = voice;
        utterance.rate = 1;
        utterance.pitch = 1.35; // lighter, robot-friend tone for the device voice fallback
        if (index === chunks.length - 1) { utterance.onend = finish; utterance.onerror = finish; }
        speechSynthesis.speak(utterance);
      });
      setTimeout(finish, text.length * 110 + 4000);
    });
  }

  function playBlob(blob: Blob, controller: AbortController): Promise<void> {
    if (!blob.type.startsWith("audio/")) return Promise.reject(new Error("Respons suara tidak valid."));
    if (playerUrl) URL.revokeObjectURL(playerUrl);
    playerUrl = URL.createObjectURL(blob);
    const audio = new Audio(playerUrl);
    player = audio;
    return new Promise<void>((resolve, reject) => {
      finishSpeech = () => { controller.abort(); resolve(); };
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Speaker gagal memutar suara."));
      audio.play().catch(reject);
    });
  }

  // Plays the answer part by part: part 0 is short, so speech starts after one short
  // TTS call while later parts are generated in the background.
  async function speakAnswer(jobId: string, text: string) {
    if (state.phase === "off" || state.phase === "starting") return;
    const token = run;
    clearInterval(thinkingTimer);
    releaseSpeech();
    clearTimeout(listenTimer);
    set({ phase: "speaking", notice: "" });
    const controller = new AbortController();
    speechController = controller;
    const parts = answerChunks(text);
    const fetchPart = (index: number) => {
      const request = callbacks.fetchSpeech(jobId, index, controller.signal);
      request.catch(() => undefined);
      return request;
    };
    let spoken = 0;
    try {
      let next = fetchPart(0);
      for (let index = 0; index < parts.length; index++) {
        const blob = await next;
        if (controller.signal.aborted || token !== run) break;
        if (index + 1 < parts.length) next = fetchPart(index + 1);
        await playBlob(blob, controller);
        spoken = index + 1;
        if (controller.signal.aborted || token !== run) break;
      }
    } catch {
      // Gemini TTS unavailable: read the remaining parts with the device voice.
      if (!controller.signal.aborted && token === run) await say(parts.slice(spoken).join(" ") || text);
    } finally {
      if (speechController === controller) speechController = null;
      finishSpeech = null;
      player?.pause();
      player = null;
      if (playerUrl) URL.revokeObjectURL(playerUrl);
      playerUrl = null;
    }
    // stop() may have run while audio was playing; the run token covers that case.
    if (token === run) enterListening(FOLLOW_UP_MS, true, "Ada pertanyaan lanjutan? Langsung bicara saja.");
  }

  async function announce(text: string) {
    if (state.phase === "off" || state.phase === "starting") return;
    const token = run;
    clearInterval(thinkingTimer);
    await say(text);
    if (token === run) enterWaiting();
  }

  function stopSpeaking() {
    releaseSpeech();
  }

  function stop() {
    ++run;
    clearInterval(thinkingTimer);
    recognitionWanted = false;
    try { recognition?.abort(); } catch { /* ignore */ }
    recognition = null;
    recognitionFailures = 0;
    clearTimeout(listenTimer);
    clearSegment();
    releaseSpeech();
    nodes.forEach(node => { try { node.disconnect(); } catch { /* ignore */ } });
    nodes = [];
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    void context?.close().catch(() => undefined);
    context = null;
    browserFinals = [];
    set({ phase: "off", level: 0, notice: "", followUp: false });
  }

  return {
    start, resume, stop, speakAnswer, announce, stopSpeaking,
    get state() { return state; },
  };
}

// Gemini transcribes speech while voice mode is active; only a fresh wake phrase authorizes a chat question.
import {
  answerChunks,
  concatFrames,
  createVad,
  detectWakePhrase,
  downsample,
  encodeWav,
  hasQuestion,
  rms,
  toBase64,
} from "./handsfree";

export type HandsFreePhase =
  | "off"
  | "starting"
  | "blocked"
  | "waiting"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking";

export interface HandsFreeState {
  phase: HandsFreePhase;
  level: number;
  engine: "gemini";
  heard: string;
  notice: string;
  error: string;
  followUp: boolean;
}

export interface HandsFreeCallbacks {
  transcribe(mimeType: string, base64: string, signal: AbortSignal): Promise<string>;
  fetchSpeech(jobId: string, part: number, signal: AbortSignal): Promise<Blob>;
  onQuestion(text: string): Promise<boolean>;
  onState(state: HandsFreeState): void;
  onPlayback?(audio: Blob | null, text: string, emotion?: string): void;
  beforePlayback?(audio: Blob, text: string, signal: AbortSignal, emotion?: string): Promise<void>;
  fetchAnnouncement?(text: string, signal: AbortSignal): Promise<Blob>;
}

export interface HandsFreeEngine {
  start(): Promise<void>;
  resume(): Promise<void>;
  stop(): void;
  speakAnswer(jobId: string, text: string, emotion?: string): Promise<void>;
  announce(text: string): Promise<void>;
  stopSpeaking(): void;
  readonly state: HandsFreeState;
}

const TARGET_RATE = 16000;
const PRE_ROLL_MS = 450;
const LISTEN_TIMEOUT_MS = 9000;
const MAX_QUESTION_MS = 20000;
const END_SILENCE_MS = 1100;
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

export function createHandsFreeEngine(callbacks: HandsFreeCallbacks): HandsFreeEngine {
  let state: HandsFreeState = {
    phase: "off",
    level: 0,
    engine: "gemini",
    heard: "",
    notice: "",
    error: "",
    followUp: false,
  };
  let run = 0;
  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  let nodes: AudioNode[] = [];
  let transcription: AbortController | null = null;
  let lastWakeAttempt = -Infinity;
  let queuedSpeech: { frames: Float32Array[]; rate: number; duration: number } | null = null;
  let queuedTimer: ReturnType<typeof setTimeout> | undefined;
  const vad = createVad({ maxSpeechMs: MAX_QUESTION_MS, endSilenceMs: END_SILENCE_MS });
  let preRoll: Float32Array[] = [];
  let preRollMs = 0;
  let segment: Float32Array[] | null = null;
  let segmentStartedAt = 0;
  let wakeAuthorized = false;
  let ignoreUntil = 0;
  let listenTimer: ReturnType<typeof setTimeout> | undefined;
  let frameCount = 0;
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
    preRoll = [];
    preRollMs = 0;
    vad.reset();
  }

  function enterWaiting(notice = "") {
    clearTimeout(listenTimer);
    clearInterval(thinkingTimer);
    clearSegment();
    queuedSpeech = null;
    clearTimeout(queuedTimer);
    wakeAuthorized = false;
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
    const tones =
      kind === "wake" ? [660, 880] : kind === "sent" ? [740] : kind === "tick" ? [600] : [520, 390];
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
      clearTimeout(listenTimer);
    } else if (event === "end" && segment) {
      const frames = segment;
      const duration = Math.max(0, now() - segmentStartedAt - PRE_ROLL_MS - END_SILENCE_MS);
      segment = null;
      void handleSegment(frames, context.sampleRate, duration);
    }
  }

  async function transcribeFrames(frames: Float32Array[], rate: number): Promise<string> {
    const wav = encodeWav(downsample(concatFrames(frames), rate, TARGET_RATE), TARGET_RATE);
    const controller = new AbortController();
    transcription = controller;
    try {
      return (await callbacks.transcribe("audio/wav", toBase64(wav), controller.signal)).trim();
    } finally {
      if (transcription === controller) transcription = null;
    }
  }

  async function handleSegment(frames: Float32Array[], rate: number, duration: number) {
    if (duration < 200) return; // clicks and short noises
    const token = run;
    if (transcription || (state.phase === "waiting" && now() - lastWakeAttempt < 2500)) {
      queuedSpeech = { frames, rate, duration };
      drainSpeech();
      return;
    }
    if (state.phase === "waiting") {
      lastWakeAttempt = now();
      set({ notice: "Memeriksa panggilan…", error: "" });
      try {
        const text = await transcribeFrames(frames, rate);
        if (token !== run || state.phase !== "waiting") return;
        const wake = detectWakePhrase(text, true);
        if (!wake.matched) {
          set({ notice: "Awali dengan Halo AERO-BOT, lalu sampaikan pertanyaan." });
          return;
        }
        wakeAuthorized = true;
        set({ heard: text, error: "" });
        if (hasQuestion(wake.remainder)) return ask(wake.remainder);
        earcon("wake");
        enterListening(
          LISTEN_TIMEOUT_MS,
          false,
          "Panggilan dikenali. Silakan sampaikan pertanyaan.",
        );
      } catch (error) {
        if (token === run)
          set({
            notice: "",
            error:
              error instanceof Error
                ? error.message
                : "Panggilan belum dapat dikenali. Silakan ulangi.",
          });
      } finally {
        if (token === run) drainSpeech();
      }
      return;
    }
    if (state.phase === "listening") {
      set({ phase: "transcribing", notice: "" });
      let text = "";
      try {
        text = await transcribeFrames(frames, rate);
      } catch (error) {
        if (token !== run) return;
        const message = error instanceof Error ? error.message : "Suara belum terbaca.";
        set({ error: message });
        await say(
          /sibuk/i.test(message)
            ? "Maaf, layanan sedang sibuk. Silakan ulangi pertanyaan Anda."
            : "Maaf, suara belum terdengar jelas. Silakan ulangi.",
        );
        if (token === run) enterListening(LISTEN_TIMEOUT_MS, true);
        return;
      }
      if (token !== run) return;
      const wake = detectWakePhrase(text, true);
      const question = wake.matched ? wake.remainder : text;
      if (!hasQuestion(question)) {
        if (wake.matched) {
          earcon("wake");
          enterListening(LISTEN_TIMEOUT_MS, false);
          return;
        }
        await say("Maaf, belum terdengar jelas. Silakan ulangi.");
        if (token === run) enterListening(LISTEN_TIMEOUT_MS, true);
        return;
      }
      return ask(question);
    }
  }

  function drainSpeech() {
    clearTimeout(queuedTimer);
    if (!queuedSpeech || transcription) return;
    if (state.phase !== "waiting" && state.phase !== "listening") {
      queuedSpeech = null;
      return;
    }
    const delay = state.phase === "waiting" ? Math.max(0, 2500 - (now() - lastWakeAttempt)) : 0;
    if (delay > 0) {
      queuedTimer = setTimeout(drainSpeech, delay);
      return;
    }
    const speech = queuedSpeech;
    queuedSpeech = null;
    void handleSegment(speech.frames, speech.rate, speech.duration);
  }

  async function ask(question: string) {
    if (!wakeAuthorized) {
      enterWaiting();
      return;
    }
    wakeAuthorized = false;
    queuedSpeech = null;
    clearTimeout(queuedTimer);
    clearSegment();
    const token = run;
    clearTimeout(listenTimer);
    set({ phase: "thinking", heard: question, error: "", notice: "" });
    earcon("sent");
    // Confirm receipt with an earcon; a second narrator would change the bot's voice.
    clearInterval(thinkingTimer);
    thinkingTimer = setInterval(() => {
      if (token !== run || state.phase !== "thinking") {
        clearInterval(thinkingTimer);
        return;
      }
      earcon("tick");
    }, 2500);
    let sent = false;
    try {
      sent = await callbacks.onQuestion(question);
    } catch {
      sent = false;
    }
    if (token !== run) return;
    if (!sent) {
      await say("Pertanyaan belum terkirim. Silakan coba lagi.");
      if (token === run) enterWaiting();
    }
  }

  async function setupAudio(media: MediaStream) {
    const audio = new AudioContext();
    context = audio;
    const source = audio.createMediaStreamSource(media);
    const sink = audio.createGain();
    sink.gain.value = 0;
    let tap: AudioNode;
    if (audio.audioWorklet) {
      const url = URL.createObjectURL(
        new Blob([workletSource], { type: "application/javascript" }),
      );
      try {
        await audio.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      const worklet = new AudioWorkletNode(audio, "aerosense-mic-tap", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: "explicit",
      });
      worklet.port.onmessage = (event) => onFrame(event.data as Float32Array);
      tap = worklet;
    } else {
      const processor = audio.createScriptProcessor(1024, 1, 1);
      processor.onaudioprocess = (event) =>
        onFrame(new Float32Array(event.inputBuffer.getChannelData(0)));
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
    lastWakeAttempt = -Infinity;
    set({ phase: "starting", error: "", notice: "", heard: "" });
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });
      if (token !== run) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = media;
      media.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (token === run) {
            stop();
            set({ error: "Mikrofon terputus. Sambungkan lagi lalu aktifkan mode suara." });
          }
        };
      });
      await setupAudio(media);
      if (token !== run) return;
      if (context!.state !== "running") await context!.resume().catch(() => undefined);
      if (context!.state !== "running") {
        set({ phase: "blocked" });
        return;
      }
      goLive();
    } catch (error) {
      if (token !== run) return;
      stop();
      set({
        error:
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Izin mikrofon ditolak. Izinkan mikrofon di pengaturan situs, lalu aktifkan lagi."
            : error instanceof Error
              ? error.message
              : "Mikrofon belum tersedia.",
      });
    }
  }

  function goLive() {
    set({ engine: "gemini" });
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
    const finish = finishSpeech;
    finishSpeech = null;
    finish?.();
  }

  async function say(text: string) {
    if (!callbacks.fetchAnnouncement || !text.trim()) return;
    const previous = state.phase;
    const controller = new AbortController();
    speechController = controller;
    set({ phase: "speaking" });
    try {
      const blob = await callbacks.fetchAnnouncement(text, controller.signal);
      if (!controller.signal.aborted) await playBlob(blob, controller, text);
    } catch {
      if (!controller.signal.aborted) set({ notice: text });
    } finally {
      if (speechController === controller) speechController = null;
      callbacks.onPlayback?.(null, "");
      if (state.phase === "speaking") set({ phase: previous });
    }
  }

  async function playBlob(
    blob: Blob,
    controller: AbortController,
    text = "",
    emotion?: string,
  ): Promise<void> {
    if (!blob.type.startsWith("audio/"))
      return Promise.reject(new Error("Respons suara tidak valid."));
    if (playerUrl) URL.revokeObjectURL(playerUrl);
    playerUrl = URL.createObjectURL(blob);
    const audio = new Audio(playerUrl);
    player = audio;
    audio.onplaying = () => {
      clearInterval(thinkingTimer);
      set({ phase: "speaking" });
      callbacks.onPlayback?.(blob, text, emotion);
    };
    audio.load();
    await callbacks.beforePlayback?.(blob, text, controller.signal, emotion);
    if (controller.signal.aborted) return;
    return new Promise<void>((resolve, reject) => {
      finishSpeech = () => {
        controller.abort();
        resolve();
      };
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Speaker gagal memutar suara."));
      audio.play().catch(reject);
    });
  }

  // Plays the answer part by part: part 0 is short, so speech starts after one short
  // TTS call while later parts are generated in the background.
  async function speakAnswer(jobId: string, text: string, emotion?: string) {
    if (state.phase === "off" || state.phase === "starting") return;
    const token = run;
    clearInterval(thinkingTimer);
    releaseSpeech();
    clearTimeout(listenTimer);
    set({ phase: "thinking", notice: "" });
    earcon("tick");
    thinkingTimer = setInterval(() => {
      if (state.phase === "thinking") earcon("tick");
    }, 3000);
    const controller = new AbortController();
    speechController = controller;
    const parts = answerChunks(text);
    const fetchPart = (index: number) => {
      const request = callbacks.fetchSpeech(jobId, index, controller.signal);
      request.catch(() => undefined);
      return request;
    };
    try {
      let next = fetchPart(0);
      for (let index = 0; index < parts.length; index++) {
        const blob = await next;
        if (controller.signal.aborted || token !== run) break;
        if (index + 1 < parts.length) next = fetchPart(index + 1);
        await playBlob(blob, controller, parts[index], emotion);
        if (controller.signal.aborted || token !== run) break;
      }
    } catch {
      if (!controller.signal.aborted && token === run)
        set({ error: "Suara AERO-BOT belum tersedia. Teks jawaban tetap dapat dibaca." });
    } finally {
      clearInterval(thinkingTimer);
      if (speechController === controller) speechController = null;
      finishSpeech = null;
      player?.pause();
      player = null;
      if (playerUrl) URL.revokeObjectURL(playerUrl);
      playerUrl = null;
      callbacks.onPlayback?.(null, "");
    }
    // stop() may have run while audio was playing; the run token covers that case.
    if (token === run) enterWaiting("Ucapkan Halo AERO-BOT untuk pertanyaan berikutnya.");
  }

  async function announce(text: string) {
    if (state.phase === "off" || state.phase === "starting") return;
    const token = run;
    clearInterval(thinkingTimer);
    await say(text);
    if (token === run) enterWaiting();
  }

  function stopSpeaking() {
    clearInterval(thinkingTimer);
    releaseSpeech();
  }

  function stop() {
    ++run;
    clearInterval(thinkingTimer);
    transcription?.abort();
    transcription = null;
    queuedSpeech = null;
    clearTimeout(queuedTimer);
    clearTimeout(listenTimer);
    clearSegment();
    releaseSpeech();
    nodes.forEach((node) => {
      try {
        node.disconnect();
      } catch {
        /* ignore */
      }
    });
    nodes = [];
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    void context?.close().catch(() => undefined);
    context = null;
    set({ phase: "off", level: 0, notice: "", followUp: false });
  }

  return {
    start,
    resume,
    stop,
    speakAnswer,
    announce,
    stopSpeaking,
    get state() {
      return state;
    },
  };
}

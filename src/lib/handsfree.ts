// Pure helpers for the hands-free AERO-BOT voice mode. No DOM access here so the
// logic can be unit tested with Node.

const WAKE_TARGET = "aerobot";
const GREETINGS = new Set(["halo", "hallo", "helo", "hello", "alo", "hai", "hei", "hey", "hi", "oke", "ok", "okay"]);
// Frequent Indonesian speech-to-text spellings that are too far from "aerobot" by edit distance.
const ALIASES = new Set(["errorbot", "eurobot", "airbot", "aerobat", "aerobott", "erobott"]);
const FILLERS = new Set(["ya", "iya", "eh", "em", "emm", "hmm", "hm", "ehm", "anu", "oh", "ah", "nah", "tolong"]);

interface Token { norm: string; start: number; end: number }

function tokens(text: string): Token[] {
  const out: Token[] = [];
  for (const match of text.matchAll(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu)) {
    const start = match.index ?? 0;
    out.push({ norm: match[0].toLowerCase().replace(/[-'’]/g, ""), start, end: start + match[0].length });
  }
  return out;
}

export function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

export interface WakeMatch { matched: boolean; remainder: string }

// Accepts common speech-to-text spellings: "Halo AERO-BOT", "halo aero bot", "hello airobot",
// "halo robot". Without a greeting the name must be closer (distance <= 1) to avoid false wakes.
export function detectWakePhrase(text: string): WakeMatch {
  const list = tokens(text);
  for (let i = 0; i < list.length; i++) {
    const greeted = i > 0 && GREETINGS.has(list[i - 1].norm);
    let joined = "";
    for (let span = 0; span < 3 && i + span < list.length; span++) {
      joined += list[i + span].norm;
      if (joined.length < 5 || joined.length > 10) continue;
      const distance = editDistance(joined, WAKE_TARGET);
      if (distance <= 1 || (greeted && (distance <= 2 || ALIASES.has(joined)))) {
        const remainder = text.slice(list[i + span].end).replace(/^[\s,.;:!?…–—-]+/, "").trim();
        return { matched: true, remainder };
      }
    }
  }
  return { matched: false, remainder: text.trim() };
}

export function hasQuestion(text: string): boolean {
  return tokens(text).some(token => !FILLERS.has(token.norm) && !GREETINGS.has(token.norm) && token.norm.length > 1);
}

export interface Vad {
  push(rms: number, frameMs: number): "start" | "end" | null;
  reset(): void;
  readonly speaking: boolean;
}

export interface VadOptions {
  minThreshold?: number;
  startMs?: number;
  endSilenceMs?: number;
  maxSpeechMs?: number;
}

// Energy based voice activity detection with an adaptive noise floor.
export function createVad(options: VadOptions = {}): Vad {
  const minThreshold = options.minThreshold ?? 0.012;
  const startMs = options.startMs ?? 160;
  const endSilenceMs = options.endSilenceMs ?? 1100;
  const maxSpeechMs = options.maxSpeechMs ?? 20000;
  let noise = 0.004;
  let speaking = false;
  let above = 0;
  let below = 0;
  let speechMs = 0;
  return {
    get speaking() { return speaking; },
    reset() { speaking = false; above = 0; below = 0; speechMs = 0; },
    push(rms, frameMs) {
      const threshold = Math.max(minThreshold, noise * 3.2);
      if (!speaking) {
        if (rms > threshold) {
          above += frameMs;
          if (above >= startMs) {
            speaking = true;
            speechMs = above;
            below = 0;
            return "start";
          }
        } else {
          above = 0;
          noise = Math.min(0.05, noise * 0.97 + rms * 0.03);
        }
        return null;
      }
      speechMs += frameMs;
      if (rms < threshold * 0.75) below += frameMs;
      else below = 0;
      if (below >= endSilenceMs || speechMs >= maxSpeechMs) {
        speaking = false;
        above = 0;
        return "end";
      }
      return null;
    },
  };
}

export function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return samples.length ? Math.sqrt(sum / samples.length) : 0;
}

export function concatFrames(frames: Float32Array[]): Float32Array {
  const out = new Float32Array(frames.reduce((total, frame) => total + frame.length, 0));
  let offset = 0;
  for (const frame of frames) { out.set(frame, offset); offset += frame.length; }
  return out;
}

// Box-filter decimation. Good enough for speech sent to a transcription model.
export function downsample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (toRate >= fromRate) return input;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

// Splits long answers so browser speech synthesis does not cut off after ~15 seconds.
export function speechChunks(text: string, max = 180): string[] {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?…]+[.!?…]*/g) || [];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length > max && current) { chunks.push(current.trim()); current = ""; }
    current += " " + sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

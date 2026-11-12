// Wibowo TTS (open-source, Indonesian) running in the aerosense-tts container. Returns WAV bytes.
// Used when TTS_PROVIDER=wibowo; otherwise the API keeps using Gemini TTS.
export const useWibowo = (env) => env.TTS_PROVIDER === "wibowo";

export async function wibowoSpeech(env, text, timeoutMs = 90000) {
  if (!env.WIBOWO_TTS_KEY) throw new Error("WIBOWO_TTS_KEY is not set");
  const r = await fetch(env.WIBOWO_TTS_URL || "http://aerosense-tts:4220/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Local-TTS-Key": env.WIBOWO_TTS_KEY },
    body: JSON.stringify({ text: String(text).slice(0, 2000) }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw Object.assign(new Error("Wibowo HTTP " + r.status), { status: r.status === 503 ? 503 : 502 });
  const audio = Buffer.from(await r.arrayBuffer());
  if (audio.length < 44 || audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 12) !== "WAVE")
    throw Object.assign(new Error("Wibowo returned invalid audio"), { status: 502 });
  return audio;
}

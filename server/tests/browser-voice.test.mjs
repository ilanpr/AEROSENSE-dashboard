import test from "node:test";
import assert from "node:assert/strict";
import { browserVoiceRoutes } from "../api/browser-voice.mjs";

test("browser voice requires auth and owned replies, validates recordings, and never stores audio", async () => {
  let authorized = true, payload = {}, modelCalls = [], ended, status;
  const wav = Buffer.alloc(44);
  wav.write("RIFF"); wav.writeUInt32LE(36, 4); wav.write("WAVE", 8);
  const env = { GEMINI_API_KEY: "test-server-secret" };
  const reply = { owner_id: "owner", body: { node_ids: ["n1"] }, status: "done", result: { text: "Pantau kondisi lingkungan." } };
  const route = browserVoiceRoutes({
    env,
    user: async () => { if (!authorized) throw Object.assign(Error("Unauthorized"), { status: 401 }); return { id: "owner" }; },
    one: async (_table, query) => query.includes("id=eq.own&owner_id=eq.owner") ? reply : null,
    member: async (_user, id) => assert.equal(id, "n1"),
    rate: () => {}, rawBody: async () => Buffer.from(JSON.stringify(payload)),
    send: (_res, code, body) => { status = code; ended = body; },
    gemini: async (_system, input, extra) => {
      modelCalls.push({ input, extra });
      return { status: "completed", steps: [{ type: "model_output", content: extra?.response_format?.type === "audio"
        ? [{ type: "audio", mime_type: "audio/wav", data: wav.toString("base64") }]
        : [{ type: "text", text: "Bagaimana kondisi udara?" }] }] };
    },
  });
  const res = { writeHead: code => { status = code; }, end: body => { ended = body; } };
  const run = (path, method = "POST") => route({ method }, res, new URL("http://test/v1/voice/" + path));
  authorized = false;
  await assert.rejects(run("speak"), { status: 401 });
  authorized = true;
  await run("config", "GET");
  assert.equal(ended.configured, true);
  assert(!JSON.stringify(ended).includes("test-server-secret"));
  payload = { job_id: "foreign" };
  await assert.rejects(run("speak"), { status: 404 });
  payload = { job_id: "own" };
  await run("speak");
  assert.equal(status, 200); assert(Buffer.isBuffer(ended));
  assert.equal(modelCalls[0].input[0].content[0].text, reply.result.text);
  const callsBeforeReplay = modelCalls.length;
  await run("speak");
  assert.equal(modelCalls.length, callsBeforeReplay, "repeat playback reuses audio after access checks");
  authorized = false;
  await assert.rejects(run("speak"), { status: 401 });
  authorized = true;
  payload = { test: true, text: "Do not speak arbitrary input" };
  await run("speak");
  assert(!JSON.stringify(modelCalls.at(-1)).includes(payload.text));
  payload = { mime_type: "audio/webm", audio_base64: Buffer.alloc(45).toString("base64") };
  await assert.rejects(run("transcribe"), /tidak valid/);
  const webm = Buffer.alloc(45); Buffer.from("1a45dfa3", "hex").copy(webm);
  payload.audio_base64 = webm.toString("base64");
  await run("transcribe");
  assert.equal(ended.text, "Bagaimana kondisi udara?");
  env.GEMINI_API_KEY = "";
  await run("config", "GET"); assert.equal(ended.configured, false);
  await assert.rejects(run("speak"), { status: 503 });
});

test("transcription retries Gemini high-demand errors and falls back to the next model", async () => {
  const { transcribeWithFallback, transcriptionModels } = await import("../api/browser-voice.mjs");
  const env = { GEMINI_TEXT_MODEL: "busy-model", GEMINI_TRANSCRIBE_FALLBACK_MODELS: "missing-model, spare-model" };
  assert.deepEqual(transcriptionModels(env), ["busy-model", "missing-model", "spare-model"]);
  const calls = [];
  const gemini = async (_system, _input, extra) => {
    calls.push(extra.model);
    if (extra.model === "busy-model") throw Object.assign(Error("Upstream HTTP 503"), { status: 503 });
    if (extra.model === "missing-model") throw Object.assign(Error("Upstream HTTP 404"), { status: 404 });
    return { steps: [{ type: "model_output", content: [{ type: "text", text: "Halo" }] }] };
  };
  const result = await transcribeWithFallback(gemini, env, "audio/wav", "AAAA", { delays: [1, 1] });
  assert.equal(result.steps[0].content[0].text, "Halo");
  assert.deepEqual(calls, ["busy-model", "busy-model", "busy-model", "missing-model", "spare-model"]);
  const denied = async () => { throw Object.assign(Error("Upstream HTTP 403"), { status: 403 }); };
  await assert.rejects(transcribeWithFallback(denied, env, "audio/wav", "AAAA", { delays: [1] }), { status: 403 });
});

test("hands-free wake phrase, voice activity and WAV helpers", async t => {
  let lib;
  try { lib = await import("../../src/lib/handsfree.ts"); }
  catch { t.skip("Node in this environment cannot import TypeScript directly (needs Node 22.18+)."); return; }
  const { detectWakePhrase, hasQuestion, createVad, encodeWav } = lib;
  assert.deepEqual(detectWakePhrase("Halo AERO-BOT, bagaimana kualitas udara hari ini?"), { matched: true, remainder: "bagaimana kualitas udara hari ini?" });
  assert.equal(detectWakePhrase("halo aero bot").matched, true);
  assert.equal(detectWakePhrase("Hello airobot cuaca hari ini").remainder, "cuaca hari ini");
  assert.equal(detectWakePhrase("halo robot").matched, true);
  assert.equal(detectWakePhrase("saya suka robot").matched, false);
  assert.equal(detectWakePhrase("halo semua").matched, false);
  assert.equal(hasQuestion(""), false);
  assert.equal(hasQuestion("ya"), false);
  assert.equal(hasQuestion("cuaca?"), true);
  const vad = createVad({ endSilenceMs: 400 });
  const events = [];
  for (let i = 0; i < 30; i++) events.push(vad.push(0.003, 20));
  for (let i = 0; i < 40; i++) events.push(vad.push(0.09, 20));
  for (let i = 0; i < 30; i++) events.push(vad.push(0.003, 20));
  assert.deepEqual(events.filter(Boolean), ["start", "end"]);
  const wav = encodeWav(new Float32Array(160), 16000);
  assert.equal(Buffer.from(wav.subarray(0, 4)).toString(), "RIFF");
  assert.equal(wav.length, 44 + 320);
});

test("spoken answers are split into a short first part and match the browser split", async () => {
  const { answerChunks } = await import("../api/browser-voice.mjs");
  const answer = "Kualitas udara di titik ini relatif bersih. Debu terukur 12 µg/m³ pada pukul 16.00. Tetap buka jendela pada pagi hari. Kurangi pembakaran sampah di sekitar rumah. Gunakan masker bila berkendara di jalan padat. Pantau kembali dalam satu jam.";
  const parts = answerChunks(answer);
  assert(parts.length >= 2);
  assert(parts[0].length <= 140);
  assert.equal(parts.join(" "), answer.normalize("NFKC"));
  let browser;
  try { browser = await import("../../src/lib/handsfree.ts"); } catch { return; }
  assert.deepEqual(browser.answerChunks(answer), parts);
});

test("spoken text keeps values and drops source and time details", async () => {
  const { speechText, answerChunks } = await import("../api/browser-voice.mjs");
  const answer = "Udara cukup bersih.\n\nData sensor:\n• Lab Robot: Debu 12.4 µg/m³ · 20 Okt, 17.21 WIB\n\nBerita nasional:\n• Karhutla: Pemadaman di Kalteng · ANTARA · 20 Okt, 17.31 WIB";
  assert.equal(speechText(answer), "Udara cukup bersih. Data sensor: Lab Robot: Debu 12.4 µg/m³. Berita nasional: Karhutla: Pemadaman di Kalteng.");
  assert.equal(speechText("Udara cukup bersih.\n\nSumber: ANTARA (20 Okt, 14.31 WIB)."), "Udara cukup bersih.");
  let browser;
  try { browser = await import("../../src/lib/handsfree.ts"); } catch { return; }
  assert.deepEqual(browser.answerChunks(answer), answerChunks(answer));
});

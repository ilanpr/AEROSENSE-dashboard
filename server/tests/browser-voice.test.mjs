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

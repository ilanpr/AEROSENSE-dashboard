import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifyMeta,
  validateTelemetry,
  parseGate,
  modelText,
  waPayload,
  wavAudio,
  cleanText,
  abusive,
  isFresh,
  validateInputWav,
} from "../api/core.mjs";
test("Meta webhook rejects tampering and missing signatures", () => {
  const raw = Buffer.from('{"hello":true}');
  const signature = "sha256=" + createHmac("sha256", "secret").update(raw).digest("hex");
  assert(verifyMeta(raw, signature, "secret"));
  assert(!verifyMeta(Buffer.from("{}"), signature, "secret"));
  assert(!verifyMeta(raw, undefined, "secret"));
});
test("Telemetry validates sensor types, clock, node and model contract", () => {
  const node = { id: "n1", enabled: true, pm25_validated: false };
  const p = {
    node_id: "n1",
    boot_id: "abc",
    sequence: 0,
    observed_at: new Date().toISOString(),
    metrics: { eco2_ppm: 700, dust_ug_m3: 20 },
  };
  assert.equal(validateTelemetry(p, node).gru, null);
  assert.throws(() => validateTelemetry({ ...p, metrics: { pm25_ug_m3: 20 } }, node));
  assert.throws(() => validateTelemetry({ ...p, metrics: { eco2_ppm: "700" } }, node));
  assert.throws(() => validateTelemetry({ ...p, observed_at: "bad" }, node));
  assert.throws(() => validateTelemetry({ ...p, gru: { value: 12 } }, node));
  assert.equal(isFresh({ ...p, observed_at: new Date(Date.now() - 700000).toISOString() }), false);
});
test("Policy fails closed for malformed or adversarial model responses", () => {
  assert.equal(parseGate('{"decision":"allow"}'), true);
  assert.equal(parseGate('{"decision":"deny"}'), false);
  assert.throws(() => parseGate('{"decision":"yes"}'));
  assert.throws(() => parseGate("Of course I can help"));
  assert.throws(() => modelText({ status: "failed", steps: [] }));
  assert(abusive("f\u200Buck".replace("\u200B", "")));
  assert.equal(cleanText("  polusi udara  "), "polusi udara");
  assert.throws(() => cleanText(""));
});
test("WhatsApp uses templates outside the service window and honors closed chats", () => {
  const c = {
    last_inbound_at: new Date(Date.now() - 48 * 3600000).toISOString(),
  };
  const env = { WHATSAPP_ALERT_TEMPLATE: "aerosense_alert" };
  const job = {
    phone: "628123456789",
    text: "test",
    alert_id: "a",
    template_vars: ["Node 1", "Debu", "20"],
  };
  assert.equal(waPayload(job, c, env).type, "template");
  assert.equal(waPayload({ ...job, alert_id: null }, c, env), null);
  assert.equal(waPayload(job, { last_inbound_at: new Date().toISOString() }, env).type, "text");
  assert.throws(() => waPayload(job, c, {}));
});
test("Gemini unary WAV is validated and is not wrapped a second time", () => {
  const data = Buffer.alloc(44);
  data.write("RIFF");
  data.write("WAVE", 8);
  const r = {
    status: "completed",
    steps: [
      {
        type: "model_output",
        content: [
          {
            type: "audio",
            mime_type: "audio/wav",
            data: data.toString("base64"),
          },
        ],
      },
    ],
  };
  assert.deepEqual(wavAudio(r), data);
  assert.throws(() => wavAudio({ ...r, status: "failed" }));
});
test("Robot input accepts PCM16 mono 16 kHz WAV and rejects malformed or different formats", () => {
  const b = Buffer.alloc(44 + 32000);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(32000, 40);
  assert.equal(validateInputWav(b), b);
  const stereo = Buffer.from(b);
  stereo.writeUInt16LE(2, 22);
  assert.throws(() => validateInputWav(stereo));
  assert.throws(() => validateInputWav(b.subarray(0, 100)));
});

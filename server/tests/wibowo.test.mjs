import test from "node:test";
import assert from "node:assert/strict";
import { useWibowo, wibowoSpeech } from "../api/wibowo.mjs";

const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE"), Buffer.alloc(40)]);

test("only TTS_PROVIDER=wibowo switches to Wibowo", () => {
  assert.equal(useWibowo({ TTS_PROVIDER: "wibowo" }), true);
  assert.equal(useWibowo({}), false);
});

test("sends text with the shared key and returns WAV bytes", async (t) => {
  let seen;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    seen = { url, key: init.headers["X-Local-TTS-Key"], body: JSON.parse(init.body) };
    return new Response(wav, { status: 200 });
  });
  const audio = await wibowoSpeech({ WIBOWO_TTS_KEY: "k" }, "Halo warga");
  assert.equal(seen.url, "http://aerosense-tts:4220/speak");
  assert.equal(seen.key, "k");
  assert.equal(seen.body.text, "Halo warga");
  assert.equal(audio.toString("ascii", 0, 4), "RIFF");
});

test("refuses without a key, on errors and on non-WAV replies", async (t) => {
  await assert.rejects(wibowoSpeech({}, "x"), /WIBOWO_TTS_KEY/);
  t.mock.method(globalThis, "fetch", async () => new Response("busy", { status: 503 }));
  await assert.rejects(wibowoSpeech({ WIBOWO_TTS_KEY: "k" }, "x"), (e) => e.status === 503);
  t.mock.method(globalThis, "fetch", async () => new Response("not audio", { status: 200 }));
  await assert.rejects(wibowoSpeech({ WIBOWO_TTS_KEY: "k" }, "x"), /invalid audio/);
});

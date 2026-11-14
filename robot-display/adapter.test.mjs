import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(condition) {
  const end = Date.now() + 12000;
  while (!condition()) {
    if (Date.now() > end) throw new Error("Adapter replay timed out");
    await wait(50);
  }
}

test("local TTS fallback is opt-in and supplies device audio when cloud audio fails", async () => {
  let synthesized = 0;
  const audio = Buffer.alloc(44);
  audio.write("RIFF");
  audio.write("WAVE", 8);
  const service = http.createServer(async (req, res) => {
    if (req.url === "/speak") {
      assert.equal(req.headers["x-local-tts-key"], "fixture-only");
      let raw = "";
      for await (const chunk of req) raw += chunk;
      assert.equal(JSON.parse(raw).text, "Halo dari robot.");
      synthesized++;
      res.end(audio);
    } else if (req.url === "/v1/robot/commands") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          commands: [
            {
              id: "fallback",
              expires_at: new Date(Date.now() + 60000).toISOString(),
              body: { action: "speak", text: "Halo dari robot." },
            },
          ],
        }),
      );
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => service.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${service.address().port}`;
  const child = spawn(process.execPath, ["start.mjs"], {
    cwd: fileURLToPath(new URL("./", import.meta.url)),
    env: {
      ...process.env,
      AEROBOT_DISPLAY_PORT: "4213",
      AEROBOT_OPEN_WINDOW: "0",
      AEROSENSE_API_URL: base,
      AEROBOT_DEVICE_ID: "fallback-fixture",
      AEROBOT_DEVICE_KEY: "fixture-only",
      AEROBOT_LOCAL_TTS_URL: base + "/speak",
      AEROBOT_LOCAL_TTS_KEY: "fixture-only",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  const abort = new AbortController();
  try {
    await until(() => output.includes("physical face"));
    const response = await fetch("http://127.0.0.1:4213/events", { signal: abort.signal });
    const reader = response.body.getReader();
    let events = "";
    while (!events.includes("audioBase64"))
      events += new TextDecoder().decode((await reader.read()).value);
    assert.equal(synthesized, 1);
    assert.ok(events.includes(audio.toString("base64")));
  } finally {
    abort.abort();
    child.kill();
    await new Promise((resolve) => service.close(resolve));
  }
});
test("adapter claims only with a screen, fails interrupted speech, and accepts the following command", async () => {
  const acks = [],
    offered = new Set();
  let claims = 0,
    failAckOnce = true;
  const mock = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/v1/robot/commands") {
      ++claims;
      const id = !offered.has("first") ? "first" : !offered.has("second") ? "second" : null;
      if (id) offered.add(id);
      res.end(
        JSON.stringify({
          commands: id
            ? [
                {
                  id,
                  expires_at: new Date(Date.now() + 180000).toISOString(),
                  body: { action: "speak", text: "Halo.", audio_path: "mock-only" },
                },
              ]
            : [],
        }),
      );
      return;
    }
    if (req.url.startsWith("/v1/robot/audio/")) {
      res.setHeader("Content-Type", "audio/wav");
      res.end(Buffer.alloc(64));
      return;
    }
    if (req.url === "/v1/robot/ack") {
      let raw = "";
      for await (const c of req) raw += c;
      const ack = JSON.parse(raw);
      if (ack.id === "first" && failAckOnce) {
        failAckOnce = false;
        res.writeHead(503);
        res.end("{}");
        return;
      }
      acks.push(ack);
      res.end("{}");
      return;
    }
    res.writeHead(404);
    res.end("{}");
  });
  await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
  const api = `http://127.0.0.1:${mock.address().port}`;
  const child = spawn(process.execPath, ["start.mjs"], {
    cwd: fileURLToPath(new URL("./", import.meta.url)),
    env: {
      ...process.env,
      AEROBOT_DISPLAY_PORT: "4211",
      AEROBOT_OPEN_WINDOW: "0",
      AEROSENSE_API_URL: api,
      AEROBOT_DEVICE_ID: "replay-only",
      AEROBOT_DEVICE_KEY: "non-secret-fixture",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (b) => (output += b));
  child.stderr.on("data", (b) => (output += b));
  let firstAbort, secondAbort;
  try {
    await until(() => output.includes("physical face"));
    assert.equal((await fetch("http://127.0.0.1:4211/tts", { method: "POST" })).status, 503);
    assert.equal(
      (
        await fetch("http://127.0.0.1:4211/tts", {
          method: "POST",
          headers: { Origin: "https://untrusted.example" },
        })
      ).status,
      403,
    );
    await wait(1500);
    assert.equal(claims, 0);
    firstAbort = new AbortController();
    const first = await fetch("http://127.0.0.1:4211/events", { signal: firstAbort.signal });
    const firstReader = first.body.getReader();
    let received = "";
    while (!received.includes("audioBase64")) {
      const chunk = await firstReader.read();
      received += new TextDecoder().decode(chunk.value);
    }
    firstAbort.abort();
    await until(() => acks.some((a) => a.id === "first" && a.state === "failed"));
    secondAbort = new AbortController();
    const second = await fetch("http://127.0.0.1:4211/events", { signal: secondAbort.signal });
    const reader = second.body.getReader();
    received = "";
    while (!received.includes("audioBase64")) {
      const chunk = await reader.read();
      received += new TextDecoder().decode(chunk.value);
    }
    const ack = await fetch("http://127.0.0.1:4211/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "second", state: "done" }),
    });
    assert.equal(ack.status, 204);
    assert.ok(acks.some((a) => a.id === "second" && a.state === "done"));
    const blocked = await fetch("http://127.0.0.1:4211/", {
      headers: { Origin: "https://untrusted.example" },
    });
    assert.equal(blocked.status, 403);
  } finally {
    firstAbort?.abort();
    secondAbort?.abort();
    child.kill();
    await new Promise((resolve) => mock.close(resolve));
  }
});

test("presence retries the same event and receives the resulting robot command", async () => {
  const events = [],
    acks = [];
  let offered = false;
  const mock = http.createServer(async (req, res) => {
    assert.equal(req.headers["x-device-id"], "presence-replay");
    assert.equal(req.headers["x-device-key"], "non-secret-fixture");
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/v1/robot/event") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      events.push(JSON.parse(raw));
      res.writeHead(events.length === 1 ? 503 : 202);
      res.end(JSON.stringify({ id: "presence-job" }));
      return;
    }
    if (req.url === "/v1/robot/commands") {
      const ready = events.length >= 2 && !offered;
      if (ready) offered = true;
      res.end(
        JSON.stringify({
          commands: ready
            ? [
                {
                  id: "greeting",
                  expires_at: new Date(Date.now() + 60000).toISOString(),
                  body: { action: "speak", text: "Halo, selamat datang.", audio_path: "fixture" },
                },
              ]
            : [],
        }),
      );
      return;
    }
    if (req.url === "/v1/robot/audio/greeting") {
      res.setHeader("Content-Type", "audio/wav");
      res.end(Buffer.alloc(64));
      return;
    }
    if (req.url === "/v1/robot/ack") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      acks.push(JSON.parse(raw));
      res.end("{}");
      return;
    }
    res.writeHead(404);
    res.end("{}");
  });
  await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
  const child = spawn(process.execPath, ["start.mjs"], {
    cwd: fileURLToPath(new URL("./", import.meta.url)),
    env: {
      ...process.env,
      AEROBOT_DISPLAY_PORT: "4212",
      AEROBOT_OPEN_WINDOW: "0",
      AEROSENSE_API_URL: `http://127.0.0.1:${mock.address().port}`,
      AEROBOT_DEVICE_ID: "presence-replay",
      AEROBOT_DEVICE_KEY: "non-secret-fixture",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (b) => (output += b));
  child.stderr.on("data", (b) => (output += b));
  const abort = new AbortController();
  try {
    await until(() => output.includes("physical face"));
    const stream = await fetch("http://127.0.0.1:4212/events", { signal: abort.signal });
    const reader = stream.body.getReader();
    child.stdin.write("presence\n");
    let received = "";
    while (!received.includes("audioBase64")) {
      const chunk = await reader.read();
      received += new TextDecoder().decode(chunk.value);
    }
    assert.equal(events.length, 2);
    assert.deepEqual(events[0], events[1]);
    assert.equal(events[0].type, "presence");
    assert.match(events[0].event_id, /^ir-[a-f0-9-]+$/);
    assert.deepEqual(Object.keys(events[0]).sort(), ["event_id", "type"]);
    const ack = await fetch("http://127.0.0.1:4212/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "greeting", state: "done" }),
    });
    assert.equal(ack.status, 204);
    assert.deepEqual(acks, [{ id: "greeting", state: "done" }]);
  } finally {
    abort.abort();
    child.kill();
    await new Promise((resolve) => mock.close(resolve));
  }
});

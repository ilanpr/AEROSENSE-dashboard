import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { robotFaceRelay } from "../api/robot-face-relay.mjs";

test("face relay isolates accounts, restricts roles and never replays or accepts device commands", async () => {
  const route = robotFaceRelay({
    user: async (req) => {
      const id = req.headers.authorization;
      if (!id) throw Object.assign(new Error("Login diperlukan"), { status: 401 });
      return { id };
    },
    db: async (_table, query) => [{ role: query.includes("viewer") ? "viewer" : "operator" }],
    filter: encodeURIComponent,
    rate: () => {},
    rawBody: async (req) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      return body;
    },
    send: (res, status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    },
  });
  const server = http.createServer(async (req, res) => {
    try {
      await route(req, res, new URL(req.url, "http://local"));
    } catch (error) {
      res.writeHead(error.status || 500);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/v1/robot-face`;
  const request = (path, user, body) =>
    fetch(base + path, {
      headers: { ...(user ? { Authorization: user } : {}), "Content-Type": "application/json" },
      ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    });
  const abort = new AbortController();
  try {
    assert.equal((await request("/status")).status, 401);
    assert.equal((await request("/events", "viewer")).status, 403);
    const stream = await fetch(base + "/events", {
      headers: { Authorization: "owner" },
      signal: abort.signal,
    });
    assert.equal(stream.status, 200);
    assert.equal(stream.headers.get("x-accel-buffering"), "no");
    const reader = stream.body.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    assert.equal(first, ": connected\n\n");
    const other = await (await request("/status", "other")).json();
    assert.equal(other.connected, false);
    assert.ok(other.server_time >= other.received_at);
    assert.equal(
      (await (await request("/status?robot_id=robot-2", "owner")).json()).connected,
      false,
    );
    assert.equal(
      (await request("/events", "other", { owner_id: "owner", action: "speak" })).status,
      403,
    );
    assert.equal(
      (await request("/events", "owner", { owner_id: "owner", action: "pulse" })).status,
      400,
    );
    assert.equal(
      (
        await request("/events", "owner", {
          owner_id: "owner",
          action: "speak",
          audioBase64: "bm90LXdhdg==",
        })
      ).status,
      400,
    );
    const audio = Buffer.alloc(44);
    audio.write("RIFF");
    audio.write("WAVE", 8);
    const sent = await request("/events", "owner", {
      owner_id: "owner",
      action: "speak",
      text: "Bahaya.",
      audioBase64: audio.toString("base64"),
      commandId: "must-not-forward",
    });
    assert.equal(sent.status, 202);
    const received = JSON.parse(new TextDecoder().decode((await reader.read()).value).slice(6));
    assert.equal(received.text, "Bahaya.");
    assert.equal(received.monitorOnly, true);
    assert.equal(received.audioBase64, audio.toString("base64"));
    assert.equal(received.commandId, undefined);
    const before = Date.now();
    const scheduled = await request("/events", "owner", {
      owner_id: "owner",
      action: "speak",
      text: "Halo.",
      envelope: { values: [0, 0.5, 1, 0], frameMs: 20, durationMs: 80 },
    });
    const timing = await scheduled.json();
    assert.ok(timing.start_at >= before + 650 && timing.start_at <= Date.now() + 750);
    const timeline = JSON.parse(new TextDecoder().decode((await reader.read()).value).slice(6));
    assert.deepEqual(timeline.envelope.values, [0, 0.5, 1, 0]);
    assert.equal(timeline.start_at, timing.start_at);
    assert.equal(timeline.audioBase64, undefined);
    assert.equal(
      (
        await request("/events", "owner", {
          owner_id: "owner",
          action: "speak",
          envelope: { values: [Infinity], frameMs: 20, durationMs: 20 },
        })
      ).status,
      400,
    );
    abort.abort();
  } finally {
    abort.abort();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

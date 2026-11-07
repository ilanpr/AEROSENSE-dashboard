import test from "node:test";
import assert from "node:assert/strict";
import { createPresence } from "./presence.mjs";
import { parseIrLine } from "./ir-protocol.mjs";

test("wake only once; repeated clear readings sleep after 30 seconds", () => {
  const p = createPresence();
  assert.equal(p.update(true, 0), "wake");
  assert.equal(p.update(true, 100), null);
  for (let t = 600; t < 30100; t += 500) assert.equal(p.update(false, t), null);
  assert.equal(p.update(false, 30100), "sleep");
  assert.equal(p.state(30100).awake, false);
});
test("speech holds the face awake; loss of connection is unknown, not absence", () => {
  const p = createPresence();
  assert.equal(p.update(true, 0, true), null);
  assert.equal(p.state(4000).online, false);
  assert.equal(p.state(4000).detected, null);
  assert.equal(p.update(false, 100000), null);
  assert.equal(p.state(100000).idleMs, 0);
  for (let t = 100500; t <= 131000; t += 500) assert.equal(p.update(false, t, true), null);
  assert.equal(p.state(131000).awake, true);
  assert.equal(p.state(131000).idleMs, 0);
});
test("serial decoding handles chunk boundaries, boot text and invalid data", () => {
  const x = {
    type: "ir",
    seq: 1,
    uptime_ms: 250,
    pin: 4,
    active_low: true,
    raw: 0,
    ready: true,
    detected: true,
  };
  assert.deepEqual(parseIrLine(JSON.stringify(x)), x);
  assert.equal(parseIrLine("ESP-ROM:esp32s3"), null);
  assert.equal(parseIrLine(JSON.stringify({ ...x, detected: "true" })), null);
  assert.equal(parseIrLine(JSON.stringify({ ...x, raw: 42 })), null);
  assert.equal(parseIrLine(JSON.stringify({ ...x, uptime_ms: -1 })), null);
});

import test from "node:test";
import assert from "node:assert/strict";
import { clockOffset, envelopeFor, envelopeAt } from "./screen/timeline.js";

test("timeline compensates server processing and follows real sample energy with silent edges", () => {
  assert.equal(clockOffset(1000, 1500, 1110, 1410), 10);
  const samples = new Float32Array(1600);
  for (let i = 320; i < 960; i++) samples[i] = 0.25 * Math.sin(i * 0.1);
  const envelope = envelopeFor(samples, 16000);
  assert.equal(envelope.durationMs, 100);
  assert.equal(envelope.values[0], 0);
  assert.ok(envelope.values[1] > 0.5);
  assert.equal(envelopeAt(envelope.values, 20, -1), 0);
  assert.equal(envelopeAt(envelope.values, 20, 100), 0);
  assert.equal(envelopeAt([0, 1], 20, 10), 0.5);
});

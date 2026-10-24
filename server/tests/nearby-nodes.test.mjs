import test from "node:test";
import assert from "node:assert/strict";
import { distanceKm, nearbyNodes } from "../../src/lib/nearby-nodes.ts";
import { demoNodes } from "../../src/demo/data.ts";

test("nearby monitoring uses the user's coordinates and radius, independent of selected node", () => {
  const nodes = demoNodes(), center = { latitude: -7.299, longitude: 112.759 };
  assert.deepEqual(nearbyNodes(nodes, null, 5), []);
  assert.deepEqual(nearbyNodes(nodes, { latitude: -6.2, longitude: 106.8 }, 5), []);
  const near = nearbyNodes(nodes, center, 5);
  assert(near.length > 0 && near.every(x => x.distance <= 5));
  assert(near.filter(x => x.status.tone === "danger").length === 2);
  assert.equal(near[0].status.tone, "danger");
  assert(nearbyNodes(nodes, center, 2.5).length < near.length);
  assert.equal(distanceKm(center, center), 0);
});

test("invalid coordinates and stale danger readings cannot become current nearby danger", () => {
  const nodes = demoNodes(), center = { latitude: -7.299, longitude: 112.759 };
  const current = nodes[10];
  const stale = { ...current, id: "stale", latest: { ...current.latest, stale: true } };
  const bad = { ...current, id: "bad", latitude: NaN };
  const invalid = { ...current, id: "invalid", latest: { ...current.latest, quality: { invalid: true } } };
  const result = nearbyNodes([stale, bad, invalid], center, 5);
  assert.equal(result.length, 2);
  assert(result.every(x => x.status.tone === "pending"));
  assert.deepEqual(nearbyNodes(nodes, { latitude: 91, longitude: 0 }, 5), []);
});

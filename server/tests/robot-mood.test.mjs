import test from "node:test";
import assert from "node:assert/strict";
import { moodFor, awakeHour, startRobotMood, MOOD_EVERY_MS } from "../api/robot-mood.mjs";

const now = Date.parse("2026-11-12T03:00:00Z"); // 10.00 WIB
const latest = (pm25, extra = {}) => ({
  observed_at: new Date(now - 60000).toISOString(),
  metrics: { pm25_ug_m3: pm25, temperature_c: 33.4 },
  quality: { invalid: false },
  ...extra,
});
const rules = [{ enabled: true, metric: "pm25_ug_m3", high: 35, danger_high: 75 }];

test("bad air: red face, number, meaning and mitigation", () => {
  const m = moodFor({ latest: latest(80), rules, pm25Validated: true, slot: 1, now });
  assert.equal(m.face, "danger");
  assert.equal(m.severity, "danger");
  assert.match(m.text, /^Uhuk uhuk/);
  assert.match(m.text, /PM2\.5 di angka 80 mikrogram per meter kubik, masuk kategori tidak sehat/);
  assert.match(m.text, /Artinya debu halus/);
  assert.match(m.text, /masker N95/);
  assert.match(m.text, /Suhunya juga 33,4 derajat/);
});

test("rule bands decide the face; ISPU only when no rule", () => {
  assert.equal(moodFor({ latest: latest(40), rules, pm25Validated: true, now }).face, "warning");
  assert.equal(moodFor({ latest: latest(10), rules, pm25Validated: true, now }).face, "happy");
  assert.equal(moodFor({ latest: latest(160), rules: [], pm25Validated: true, now }).face, "danger");
  assert.equal(moodFor({ latest: latest(40), rules: [], pm25Validated: true, now }).face, "happy");
});

test("stale, invalid or missing readings stay silent", () => {
  assert.equal(moodFor({ latest: latest(80, { observed_at: new Date(now - 3600000).toISOString() }), rules, pm25Validated: true, now }), null);
  assert.equal(moodFor({ latest: latest(80, { quality: { invalid: true } }), rules, pm25Validated: true, now }), null);
  assert.equal(moodFor({ latest: null, now }), null);
});

test("unvalidated nodes speak about dust, not PM2.5", () => {
  const m = moodFor({ latest: { ...latest(0), metrics: { dust_ug_m3: 20 } }, rules: [], pm25Validated: false, now });
  assert.match(m.text, /kadar debu di angka 20/);
});

test("quiet hours and offline robots are skipped; one command per robot per slot", async () => {
  assert.equal(awakeHour(Date.parse("2026-11-12T15:00:00Z")), false); // 22.00 WIB
  assert.equal(awakeHour(now), true);
  const spoken = [];
  const db = async (table, q) =>
    table === "ae_robots"
      ? [
          { id: "r1", node_id: "n1", last_seen_at: new Date(now - 30000).toISOString() },
          { id: "r2", node_id: "n1", last_seen_at: null },
        ]
      : table === "ae_latest"
        ? [latest(80)]
        : table === "ae_nodes"
          ? [{ pm25_validated: true }]
          : rules;
  const realSetInterval = globalThis.setInterval;
  let tick;
  globalThis.setInterval = (fn) => ((tick = fn), { unref() {} });
  try {
    startRobotMood({ db, filter: encodeURIComponent, speak: async (r, key, m) => spoken.push([r.id, key, m.face]), now: () => now });
  } finally {
    globalThis.setInterval = realSetInterval;
  }
  tick();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(spoken, [["r1", "mood:r1:" + Math.floor(now / MOOD_EVERY_MS), "danger"]]);
});

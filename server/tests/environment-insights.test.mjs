import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  summarizeEnvironment,
  orderEnvironmentFacts,
} from "../api/environment-insights.mjs";
const now = Date.parse("2026-10-17T05:00:00Z");
const fact = (changes = {}) => ({
  id: "current",
  category: "weather",
  label: "Suhu udara",
  value: 33,
  unit: "°C",
  kind: "model",
  valid_at: new Date(now - 300000).toISOString(),
  fresh_until: new Date(now + 3600000).toISOString(),
  ...changes,
});
test("only current valid evidence produces a current summary, regardless of input order", () => {
  const old = fact({
    id: "old",
    value: 18,
    stale: true,
    fresh_until: new Date(now - 1).toISOString(),
  });
  const future = fact({
    id: "future",
    value: 12,
    valid_at: new Date(now + 86400000).toISOString(),
  });
  const valid = fact();
  const summary = summarizeEnvironment([old, future, valid], now).find(
    (x) => x.category === "weather",
  );
  assert.match(summary.title, /panas/);
  assert.deepEqual(summary.fact_ids, ["current"]);
  assert.equal(summary.method, "rules-v1");
  assert.equal(summarizeEnvironment([old], now)[0].available, false);
  assert.equal(summarizeEnvironment([future], now)[0].available, false);
});
test("AQI classification uses provider US AQI, never converts instantaneous PM2.5", () => {
  const pm = fact({
    category: "air_quality",
    label: "Estimasi PM2.5 wilayah",
    value: 80,
  });
  const pick = (v) =>
    summarizeEnvironment(
      [
        fact({
          category: "air_quality",
          label: "Estimasi AQI US wilayah, bukan ISPU",
          value: v,
        }),
      ],
      now,
    ).find((x) => x.category === "air_quality");
  assert.equal(
    summarizeEnvironment([pm], now).find((x) => x.category === "air_quality")
      .available,
    false,
  );
  assert.match(pick(50).title, /baik/);
  assert.match(pick(100).title, /sedang/);
  assert.match(pick(101).title, /sensitif/);
  assert.match(pick(151).title, /tidak sehat/);
  assert.equal(pick(301).tone, "danger");
  assert.equal(pick(-1).available, false);
});
test("forecasts and reference records retain their own time and meaning", () => {
  const chance = fact({
    id: "today",
    kind: "forecast",
    label: "Prakiraan peluang presipitasi maksimum",
    value: 80,
    valid_at: "2026-10-17T16:59:59Z",
    fresh_until: "2026-10-18T01:00:00Z",
  });
  const tomorrow = {
    ...chance,
    id: "tomorrow",
    valid_at: "2026-10-18T16:59:59Z",
  };
  const summary = summarizeEnvironment([tomorrow, chance], now)[0];
  assert.equal(summary.period, "forecast");
  assert.deepEqual(summary.fact_ids, ["today"]);
  const current = summarizeEnvironment([chance, fact()], now)[0];
  assert.equal(current.valid_at, fact().valid_at);
  assert(!summarizeEnvironment([fact({category:"biodiversity"})], now).some(x => x.category === "biodiversity"));
  const fire = fact({
    kind: "satellite",
    category: "fire",
    label: "Jumlah titik panas pada feed",
    value: 0,
    valid_at: null,
  });
  assert.match(
    summarizeEnvironment([fire], now).find((x) => x.category === "fire").action,
    /bukan jaminan/,
  );
});
test("rincian puts live data before forecasts, references, and expired facts", () => {
  const a = fact({ id: "old", stale: true }),
    b = fact({
      id: "future",
      kind: "forecast",
      valid_at: new Date(now + 3600000).toISOString(),
    }),
    c = fact({ id: "ref", kind: "historical" }),
    d = fact();
  assert.deepEqual(
    orderEnvironmentFacts([a, b, c, d], now).map((x) => x.id),
    ["current", "future", "ref", "old"],
  );
  assert(summarizeEnvironment([], now).every((x) => !x.available));
});

test("the actual n8n Code node preserves filters and stores only supported summaries", async () => {
  const code = await readFile(
    new URL("../../n8n/environment-normalizer.js", import.meta.url),
    "utf8",
  );
  const run = new Function("$json", "$", code);
  const at = new Date().toISOString();
  const request = {
    provider: "openmeteo_weather",
    ttl: 3600,
    source: "Open-Meteo",
    source_url: "https://open-meteo.com/",
    targets: [
      {
        id: "surabaya",
        name: "Surabaya",
        latitude: -7.24917,
        longitude: 112.75083,
      },
    ],
  };
  const response = {
    body: {
      latitude: -7.25,
      longitude: 112.75,
      utc_offset_seconds: 0,
      current: { time: at, temperature_2m: 33, precipitation: 0 },
      hourly: {
        time: [at],
        soil_temperature_0cm: [30],
        soil_moisture_0_to_1cm: [0.2],
      },
    },
  };
  const result = run(response, () => ({ item: { json: request } })).json
    .entries[0];
  assert.equal(result.ok, true);
  assert.equal(result.payload.summary_method, "rules-v1");
  assert(result.payload.insights.every((i) => i.available));
  assert.match(
    result.payload.insights.find((i) => i.category === "weather").title,
    /panas/,
  );
  assert(result.payload.facts.every((f) => f.area_id === "surabaya"));
  const rejected = run(
    { ...response, body: { ...response.body, latitude: 0, longitude: 0 } },
    () => ({ item: { json: request } }),
  ).json.entries[0];
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.payload.facts, []);
  assert.deepEqual(rejected.payload.insights, []);
});

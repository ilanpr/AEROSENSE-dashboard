import test from "node:test";
import assert from "node:assert/strict";
import {
  conditionScene,
  environmentHighlights,
  sensorSummary as sensorSummaryDefault,
} from "../../src/lib/environment-presentation.ts";
import { visibleSensorResponse } from "../../src/lib/sensor-display.ts";
import { summarizeEnvironment } from "../api/environment-insights.mjs";

// Existing cases cover the full rule set (TEMP_STATUS_PM25_ONLY = false); the temporary mode has its own test.
const sensorSummary = (node, rules, pm25Only = false) => sensorSummaryDefault(node, rules, pm25Only);
const now = Date.now();
const fact = (changes = {}) => ({
  id: "temperature",
  category: "weather",
  label: "Suhu udara",
  value: 30,
  unit: "°C",
  kind: "model",
  valid_at: new Date(now - 300000).toISOString(),
  fresh_until: new Date(now + 3600000).toISOString(),
  stale: false,
  ...changes,
});
test("highlighted numbers ignore expired readings and future measurements", () => {
  const current = fact();
  const expired = fact({
    id: "old",
    value: 99,
    fresh_until: new Date(now - 1).toISOString(),
  });
  const future = fact({
    id: "future",
    value: 55,
    valid_at: new Date(now + 86400000).toISOString(),
  });
  const insight = summarizeEnvironment([expired, future, current], now)[0];
  assert.equal(environmentHighlights(insight, [expired, future, current], now)[0].value, "30");
  assert.deepEqual(environmentHighlights({ ...insight, available: false }, [current], now), []);
});
test("condition illustration follows fresh weather evidence, not temperature alone", () => {
  const noon = Date.parse("2026-11-06T05:00:00Z");
  const midday = { valid_at: new Date(noon - 300000).toISOString(), fresh_until: new Date(noon + 3600000).toISOString() };
  const current = fact({ ...midday, value: 24 });
  for (const [code, scene] of [
    [3, "cloudy"],
    [45, "cloudy"],
    [63, "steady-rain"],
    [80, "steady-rain"],
    [95, "storm"],
    [97, "storm"],
  ]) {
    const evidence = [
      current,
      fact({
        ...midday,
        id: "code",
        label: "Kode kondisi cuaca (WMO)",
        value: code,
        unit: "",
      }),
    ];
    const insight = summarizeEnvironment(evidence, noon)[0];
    assert.equal(conditionScene(insight, evidence, noon), scene);
    if (code === 95) assert.match(insight.title, /petir/);
  }
  const oldCode = fact({
    ...midday,
    id: "code",
    label: "Kode kondisi cuaca (WMO)",
    value: 0,
    fresh_until: new Date(noon - 1).toISOString(),
  });
  assert.equal(
    conditionScene(summarizeEnvironment([current], noon)[0], [oldCode, current], noon),
    "cloudy",
  );
});
test("weather illustrations use both the condition and the reading's time in WIB", () => {
  const insight = { category: "weather", available: true };
  for (const [validAt, code, scene, title] of [
    ["2026-11-05T23:00:00Z", 0, "sunny-morning"],
    ["2026-11-06T05:00:00Z", 0, "sunny"],
    ["2026-11-06T05:00:00Z", 2, "partly-cloudy"],
    ["2026-11-06T05:00:00Z", 2, "sunny-dusk", "Cuaca terasa hangat"],
    ["2026-11-06T05:00:00Z", 2, "sunny", "Cuaca terasa panas"],
    ["2026-11-07T00:00:00Z", 3, "sunny-dusk", "Cuaca terasa hangat"],
    ["2026-11-06T05:00:00Z", 45, "cloudy", "Cuaca terasa hangat"],
    ["2026-11-06T10:00:00Z", 0, "sunny-dusk"],
    ["2026-11-06T10:00:00Z", 63, "steady-rain"],
    ["2026-11-06T11:00:00Z", 2, "sunny-night"],
    ["2026-11-06T11:00:00Z", 2, "warm-night", "Cuaca terasa hangat"],
    ["2026-11-06T11:00:00Z", 3, "warm-night", "Cuaca terasa hangat"],
    ["2026-11-06T13:00:00Z", 3, "cloudy-night"],
    ["2026-11-06T13:00:00Z", 45, "fog-night"],
    ["2026-11-06T13:00:00Z", 63, "rain-night"],
    ["2026-11-06T13:00:00Z", 95, "storm", "Cuaca terasa hangat"],
  ]) {
    const checkedAt = Date.parse(validAt) + 60000;
    const weather = fact({
      label: "Kode kondisi cuaca (WMO)",
      value: code,
      valid_at: validAt,
      fresh_until: new Date(checkedAt + 3600000).toISOString(),
    });
    assert.equal(conditionScene({ ...insight, title }, [weather], checkedAt), scene);
  }
});
test("moderate regional air quality uses the haze illustration", () => {
  const ispu = fact({
    category: "air_quality",
    label: "Estimasi ISPU PM2.5 (24 jam)",
    value: 85,
  });
  const insight = summarizeEnvironment([ispu], now).find((item) => item.category === "air_quality");
  assert.equal(conditionScene(insight, [ispu], now), "haze");
  assert.equal(conditionScene({ ...insight, available: false }, [], now), "air");
});
test("sensor summary respects hysteresis, validation and missing readings", () => {
  const rule = {
    metric: "dust_ug_m3",
    enabled: true,
    high: 80,
    clear_below: 50,
    active: true,
    unit: "µg/m³",
  };
  const node = {
    pm25_validated: false,
    latest: {
      reading_id: "test",
      stale: false,
      metrics: { dust_ug_m3: 60, pm25_ug_m3: 200 },
    },
  };
  assert.equal(sensorSummary(node, [rule]).tone, "warning");
  assert.equal(sensorSummary(node, [{ ...rule, active: false }]).tone, "calm");
  assert.doesNotMatch(sensorSummary(node, [{ ...rule, metric: "pm25_ug_m3" }]).title, /ambang/);
  assert.equal(
    sensorSummary({ ...node, latest: { ...node.latest, stale: true } }, [rule]).tone,
    "pending",
  );
  assert.equal(sensorSummary(undefined, [rule]).tone, "pending");
});

test("node bands use sensor evidence and configured thresholds, with no invented danger level", () => {
  const rule = {
    metric: "dust_ug_m3",
    enabled: true,
    active: false,
    high: 40,
    danger_high: 60,
    clear_below: 35,
    unit: "µg/m³",
  };
  const node = (value) => ({
    pm25_validated: false,
    rules: [rule],
    latest: { reading_id: "r1", stale: false, metrics: { dust_ug_m3: value } },
  });
  assert.equal(sensorSummary(node(22)).label, "Terpantau baik");
  assert.equal(sensorSummary(node(40)).label, "Waspada");
  assert.equal(sensorSummary(node(60)).label, "Bahaya");
  assert.equal(sensorSummary(node(200), [{ ...rule, danger_high: null }]).label, "Waspada");
  assert.equal(sensorSummary(node(38), [{ ...rule, active: true }]).label, "Waspada");
  assert.equal(sensorSummary(node(35), [{ ...rule, active: true }]).label, "Terpantau baik");
  for (const value of [null, NaN, Infinity, -1])
    assert.equal(sensorSummary(node(value)).label, "Data belum cukup");
  assert.equal(
    sensorSummary({ ...node(22), latest: { ...node(22).latest, stale: true } }).label,
    "Data belum cukup",
  );
  assert.equal(
    sensorSummary({ ...node(22), latest: { ...node(22).latest, quality: { invalid: true } } })
      .label,
    "Data belum cukup",
  );
  assert.equal(sensorSummary(node(22), []).label, "Data belum cukup");
  assert.equal(
    sensorSummary(node(22), [{ ...rule, metric: "temperature_c" }]).label,
    "Data belum cukup",
  );
  assert.equal(
    sensorSummary(node(22), [rule, { ...rule, metric: "tvoc_ppb" }]).label,
    "Data belum cukup",
  );
  assert.equal(
    sensorSummary(node(22), [{ ...rule, metric: "pm25_ug_m3" }]).label,
    "Data belum cukup",
  );
});

test("displayed and exported sensor data omit legacy eCO2 while retaining TVOC and humidity", () => {
  const metrics = { eco2_ppm: 400, tvoc_ppb: 15, humidity_pct: 57 };
  const rule = { metric: "eco2_ppm" };
  const latest = {
    metrics,
    quality: { channels: { eco2_ppm: { flag: "suspect" }, tvoc_ppb: { flag: "suspect" } } },
    gru: {
      task: "fault_detection",
      estimates: metrics,
      fault_scores: { eco2_ppm: 0.2, tvoc_ppb: 0.8 },
      thresholds: { eco2_ppm: 0.4, tvoc_ppb: 0.7 },
      suspect: ["eco2_ppm", "tvoc_ppb"],
    },
  };
  const filtered = visibleSensorResponse({
    nodes: [{ latest, rules: [rule] }],
    readings: [
      { metrics, raw_metrics: metrics, gru: { target: "eco2_ppm", value: 410 } },
      { metrics, gru: { target: "tvoc_ppb", value: 16 } },
    ],
    alerts: [rule, { metric: "tvoc_ppb" }],
  });
  assert.doesNotMatch(JSON.stringify(filtered), /eco2_ppm/);
  assert.deepEqual(filtered.nodes[0].latest.metrics, { tvoc_ppb: 15, humidity_pct: 57 });
  assert.deepEqual(filtered.nodes[0].latest.gru.suspect, ["tvoc_ppb"]);
  assert.equal(filtered.readings[0].gru, null);
  assert.equal(filtered.readings[1].gru.value, 16);
  assert.equal(metrics.eco2_ppm, 400);
});

test("temporary PM2.5-only status: judged on PM2.5 estimasi, a missing dust_ug_m3 no longer blocks it", () => {
  const dust = { metric: "dust_ug_m3", enabled: true, active: false, high: 50, danger_high: null, clear_below: 35 };
  const pm25 = { metric: "pm25_ug_m3", enabled: true, active: false, high: 55.4, danger_high: 150, clear_below: 35 };
  const node = (value) => ({
    pm25_validated: false,
    latest: { reading_id: "r1", stale: false, metrics: { pm25_ug_m3: value, temperature_c: 28 } },
  });
  // Production shape on 2026-11-11: dust rule enabled, no dust_ug_m3 in the reading.
  assert.equal(sensorSummary(node(41.8), [dust, pm25]).label, "Data belum cukup");
  assert.equal(sensorSummary(node(41.8), [dust, pm25], true).label, "Terpantau baik");
  assert.equal(sensorSummary(node(60), [dust, pm25], true).label, "Waspada");
  assert.equal(sensorSummary(node(160), [dust, pm25], true).label, "Bahaya");
  assert.equal(sensorSummary(node(null), [dust, pm25], true).label, "Data belum cukup");
  assert.equal(sensorSummary(node(41.8), [dust], true).label, "Data belum cukup");
  assert.equal(sensorSummaryDefault(node(41.8), [dust, pm25]).label, "Terpantau baik");
});

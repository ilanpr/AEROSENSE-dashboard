import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gruChartValue, gruEstimates } from "../../src/lib/gru.ts";
import { validateTelemetry } from "../api/core.mjs";
import { readingsCsv } from "../../src/lib/csv-export.ts";

const gru = {
  task: "fault_detection",
  mode: "shadow",
  model_version: "aerosense-stacked-gru-v7",
  horizon_seconds: 0,
  estimates: { eco2_ppm: 416.211, tvoc_ppb: 5.873, temperature_c: 26.303, humidity_pct: 57.171 },
  fault_scores: { eco2_ppm: 0.008, tvoc_ppb: 0.805, temperature_c: 0.004, humidity_pct: 0.022 },
  thresholds: { eco2_ppm: 0.708, tvoc_ppb: 0.424, temperature_c: 0.885, humidity_pct: 0.882 },
  suspect: ["tvoc_ppb"],
};

test("current multi-output GRU survives ingestion, charting, CSV and chat references", () => {
  const node = { id: "node-01", name: "Node 1 ITS", enabled: true, pm25_validated: false };
  const reading = {
    node_id: node.id,
    boot_id: "test",
    sequence: 1,
    observed_at: new Date().toISOString(),
    metrics: { eco2_ppm: 400, tvoc_ppb: 15 },
    gru,
    quality: { channels: { tvoc_ppb: { flag: "suspect" } } },
  };
  const accepted = validateTelemetry(reading, node);
  assert.deepEqual(accepted.gru, gru);
  assert.equal(accepted.metrics.eco2_ppm, 400);
  assert.equal(accepted.quality.channels.tvoc_ppb.flag, "suspect");
  assert.equal(gruChartValue(gru, "eco2_ppm"), 416.211);
  assert.equal(gruChartValue(gru, "dust_ug_m3"), null);
  assert.equal(gruChartValue({ ...gru, horizon_seconds: 60 }, "eco2_ppm"), null);
  assert.deepEqual(gruEstimates({ target: "tvoc_ppb", value: 12 }), { tvoc_ppb: 12 });
  assert.throws(() =>
    validateTelemetry({ ...reading, gru: { ...gru, fault_scores: { eco2_ppm: NaN } } }, node),
  );
  assert.throws(() =>
    validateTelemetry({ ...reading, gru: { ...gru, estimates: { pm25_ug_m3: 22 } } }, node),
  );
  const csv = readingsCsv(node, [reading], true);
  assert.doesNotMatch(csv, /416\.211|eCO₂/);
  assert.match(csv, /5\.873/);
  assert.match(csv, /Skor gangguan/);
  assert.match(csv, /shadow/);
  const source = readFileSync(
    new URL("../../n8n/chat-answer-validation.js", import.meta.url),
    "utf8",
  );
  const response = {
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                decision: "allow",
                answer: "Model memeriksa konsistensi sensor.",
                readings: [{ node_id: node.id, metric: "tvoc_ppb", source: "gru" }],
                environment_refs: [],
              }),
            },
          ],
        },
      },
    ],
  };
  const lookup = (name) => ({
    first: () => ({
      json:
        name === "Siapkan konteks hub Web"
          ? { context: [{ ...accepted, name: node.name }], environment: [] }
          : { direct_route: false },
    }),
  });
  assert.equal(new Function("$json", "$", source)(response, lookup).json.decision, "allow");
  const robotSource = readFileSync(
    new URL("../../n8n/robot-answer-validation.js", import.meta.url),
    "utf8",
  );
  const robotLookup = (name) => ({
    first: () => ({
      json:
        name === "Siapkan konteks hub Robot"
          ? { context: [{ ...accepted, name: node.name }], environment: [] }
          : { direct_route: false },
    }),
    item: { json: { job: { body: {} } } },
  });
  assert.equal(
    new Function("$json", "$", robotSource)(response, robotLookup).json.decision,
    "allow",
  );
  const waSource = source
    .replaceAll("konteks hub Web", "konteks hub WhatsApp")
    .replaceAll("Periksa input Web", "Periksa input WhatsApp");
  const waLookup = (name) => lookup(name.replaceAll("WhatsApp", "Web"));
  assert.equal(new Function("$json", "$", waSource)(response, waLookup).json.decision, "allow");
});

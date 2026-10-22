import test from "node:test";
import assert from "node:assert/strict";

test("ESG report summarizes readings and renders a valid PDF", async t => {
  let report, pdf;
  try {
    report = await import("../../src/lib/esg-report.ts");
    pdf = await import("../../src/lib/esg-report-pdf.ts");
  } catch { t.skip("Node in this environment cannot import TypeScript directly (needs Node 22.18+)."); return; }
  const now = Date.parse("2026-10-21T10:00:00Z");
  const readings = [0, 1, 2, 3, 10].map(i => ({
    id: "r" + i, observed_at: new Date(now - i * 5 * 60000).toISOString(),
    metrics: { dust_ug_m3: 10 + i * 10, eco2_ppm: 400, tvoc_ppb: null, temperature_c: 30, humidity_pct: 70 },
    gru: null, quality: { invalid: i === 2, clock_source: "sensor" }, raw_sha256: "b".repeat(64),
  }));
  const node = { id: "n1", name: "Area Produksi Pabrik", location_id: "l1", latitude: -7.28, longitude: 112.79, gateway_id: "g1",
    pm25_validated: false, calibration_version: null, rules: [{ metric: "dust_ug_m3", high: 35, danger_high: null, unit: "µg/m³", enabled: true }] };
  const digest = await report.sha256Hex(report.readingsFingerprintSource(readings));
  assert.match(digest, /^[a-f0-9]{64}$/);
  const r = report.buildReport({ node, readings, alerts: [], generatedAt: new Date(now), recipient: "PT Penerima", digest });
  const dust = r.metrics.find(m => m.key === "dust_ug_m3");
  assert.equal(dust.count, 4); // the invalid reading is excluded
  assert.equal(dust.max, 110);
  assert.equal(dust.above_threshold, 2);
  assert.equal(r.coverage.invalid_count, 1);
  assert.equal(r.coverage.gaps, 1);
  assert.ok(!r.metrics.some(m => m.key === "pm25_ug_m3"));
  assert.match(r.report_id, /^AER-20261021-N1-[A-F0-9]{6}$/);
  const bytes = pdf.renderEsgReportPdf(r, digest);
  const text = Buffer.from(bytes).toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.ok(text.trimEnd().endsWith("%%EOF"));
  assert.ok(text.includes(digest));
  assert.ok(text.includes("PT Penerima"));
  const single=report.buildReport({node,readings:readings.slice(0,1),digest,alerts:[{id:"old",created_at:new Date(now-86400000).toISOString()}]});
  assert.equal(single.alerts.total,0,"alerts outside the reporting period are excluded");
  const singlePdf=Buffer.from(pdf.renderEsgReportPdf(single,digest)).toString("latin1");
  assert.match(singlePdf,/\/Count 1/);
  assert.ok(!singlePdf.includes("Tren parameter"),"a single observation does not create empty charts");
  assert.match(text, /\/Count \d+/);
  const xref = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(xref, xref + 4), "xref");
});

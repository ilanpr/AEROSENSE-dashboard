import test from "node:test";
import assert from "node:assert/strict";
import { csvCell, csvDocument, readingsCsv, rulesCsv } from "../../src/lib/csv-export.ts";

test("CSV preserves commas, quotes, Unicode and line breaks and neutralizes spreadsheet formulas", () => {
  assert.equal(csvDocument([["Nama", "Nilai"], ['Lokasi, "A"\nUtara', 12.5]]), '\uFEFF"Nama","Nilai"\r\n"Lokasi, ""A""\nUtara","12.5"\r\n');
  for (const formula of ["=1+1", "+SUM(A1)", "@SUM(A1)", "-1+2", "  =1", "\t=1"]) assert.equal(csvCell(formula).slice(0, 2), '"\'');
  assert.equal(csvCell(-7.2), '"-7.2"');
  assert.equal(csvCell(NaN), '""');
  assert.equal(csvCell(null), '""');
});

test("reading CSV keeps missing values and unvalidated PM2.5 blank, with model columns opt-in", () => {
  const node = { id:"n1", name:"=IMPORTXML(A1)", location_id:"Kawasan ITS", latitude:-7.28, longitude:112.79, pm25_validated:false };
  const readings = [{ observed_at:"2026-10-26T00:00:00Z", metrics:{dust_ug_m3:21.5,pm25_ug_m3:999,eco2_ppm:null}, raw_metrics:{dust_ug_m3:22}, gru:{target:"dust_ug_m3",value:20,horizon_seconds:0,model_version:"gru-v1"}, quality:{invalid:true}, processing:{data_origin:"synthetic_demo"} }];
  const simple = readingsCsv(node, readings);
  assert.match(simple, /\uFEFF/);
  assert.match(simple, /µg\/m³/);
  assert.match(simple, /"'\=IMPORTXML\(A1\)"/);
  assert.match(simple, /Tidak valid/);
  assert.match(simple, /synthetic_demo/);
  assert(!simple.includes("999"));
  assert(!simple.includes("Input mentah"));
  assert(!simple.includes("gru-v1"));
  const full = readingsCsv(node, readings, true);
  assert.match(full, /Input mentah/);
  assert.match(full, /gru-v1/);
  assert.match(full, /"20","0","gru-v1"/);
});

test("threshold CSV identifies a configuration snapshot rather than historical threshold evidence", () => {
  const csv = rulesCsv({name:"ITS",location_id:"l1"}, [{metric:"dust_ug_m3",unit:"µg/m³",high:40,danger_high:60,clear_below:35,cooldown_seconds:1800,enabled:false}], "2026-10-26T01:00:00Z");
  assert.match(csv, /"40","60","35","1800","Tidak"/);
  assert.match(csv, /Konfigurasi operasional saat ekspor/);
});

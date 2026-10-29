import { dateLabel, metricLabels, type LiveNode, type Reading } from "../types/live.types.ts";

type Cell = string | number | boolean | null | undefined;

// Quoting alone does not stop spreadsheet formulas from executing in string cells.
export function csvCell(value: Cell): string {
  if (value == null || (typeof value === "number" && !Number.isFinite(value))) return '""';
  let text = String(value);
  if (typeof value === "string" && /^\s*[=+@\-\t\r\n]/.test(value)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function csvDocument(rows: Cell[][]): string {
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function readingsCsv(node: LiveNode, readings: Reading[], includeModel = false): string {
  const keys = Object.keys(metricLabels);
  const headers = ["Waktu pengamatan UTC", "Waktu pengamatan WIB", "Perangkat", "Lokasi", "Lintang", "Bujur", ...keys.map(k => metricLabels[k].join(" (" ) + ")"), "Mutu pembacaan", "Asal data"];
  if (includeModel) headers.push(...keys.map(k => "Input mentah — " + metricLabels[k].join(" (") + ")"), "Parameter model", "Estimasi model", "Horizon model (detik)", "Versi model", "Hash data mentah");
  return csvDocument([headers, ...readings.map(r => {
    const provenance = r.processing?.data_origin;
    const row: Cell[] = [r.observed_at, r.observed_at ? dateLabel(r.observed_at) : "", node.name, node.location_id, node.latitude, node.longitude,
      ...keys.map(k => k === "pm25_ug_m3" && !node.pm25_validated ? null : r.metrics[k]), r.quality?.invalid === true ? "Tidak valid" : "Tidak ditandai invalid", typeof provenance === "string" ? provenance : "Tidak dicantumkan"];
    if (includeModel) row.push(...keys.map(k => k === "pm25_ug_m3" && !node.pm25_validated ? null : r.raw_metrics?.[k]), r.gru?.target, r.gru?.value, r.gru?.horizon_seconds, r.gru?.model_version, r.raw_sha256);
    return row;
  })]);
}

export interface ExportRule { metric: string; high: number; danger_high?: number | null; clear_below: number; unit: string; cooldown_seconds: number; enabled: boolean }

export function rulesCsv(node: LiveNode, rules: ExportRule[], exportedAt = new Date().toISOString()): string {
  return csvDocument([["Waktu ekspor UTC", "Perangkat", "Lokasi", "Parameter", "Satuan", "Ambang waspada", "Ambang bahaya", "Pulih di bawah", "Jeda notifikasi (detik)", "Aktif", "Lingkup"],
    ...rules.map(r => [exportedAt, node.name, node.location_id, metricLabels[r.metric]?.[0] || r.metric, r.unit, r.high, r.danger_high, r.clear_below, r.cooldown_seconds, r.enabled ? "Ya" : "Tidak", "Konfigurasi operasional saat ekspor"]) ]);
}

export function downloadCsv(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

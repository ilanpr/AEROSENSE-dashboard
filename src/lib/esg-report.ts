// Structured ambient-monitoring report used by both the JSON and the PDF export,
// so an auditor can match the two files line by line. Pure functions: no DOM.

export interface ReportRule { metric: string; high: number; danger_high?: number | null; unit: string; enabled: boolean }
export interface ReportNode {
  id: string; name: string; location_id: string; latitude: number; longitude: number;
  gateway_id: string; pm25_validated: boolean; calibration_version: string | null; rules?: ReportRule[];
}
export interface ReportReading {
  id: string; observed_at: string; metrics: Record<string, number | null>;
  gru: { target: string; value: number; model_version: string; horizon_seconds: number } | null;
  quality?: { invalid?: boolean; clock_source?: string; calibration_version?: string | null } | null;
  raw_sha256?: string | null;
}
export interface ReportAlert { id: string; metric: string; value: number; threshold: number; unit: string; created_at: string; acknowledged_at: string | null }

export const REPORT_METRICS: { key: string; label: string; unit: string }[] = [
  { key: "dust_ug_m3", label: "Debu optik", unit: "µg/m³" },
  { key: "pm25_ug_m3", label: "PM2.5 tervalidasi", unit: "µg/m³" },
  { key: "eco2_ppm", label: "eCO2", unit: "ppm" },
  { key: "tvoc_ppb", label: "TVOC", unit: "ppb" },
  { key: "temperature_c", label: "Suhu", unit: "°C" },
  { key: "humidity_pct", label: "Kelembapan", unit: "%" },
];

export interface MetricSummary {
  key: string; label: string; unit: string; count: number;
  min: number | null; mean: number | null; median: number | null; max: number | null; latest: number | null;
  threshold: number | null; danger: number | null; above_threshold: number; above_danger: number;
}

export interface EsgReport {
  report_id: string;
  report_type: "ambient_monitoring";
  generated_at: string;
  generated_by: string | null;
  node: ReportNode;
  period: { from: string | null; to: string | null; hours: number | null };
  coverage: {
    reading_count: number; limit: number; valid_count: number; invalid_count: number;
    median_interval_minutes: number | null; gaps: number; longest_gap_minutes: number | null;
    hashed_raw_count: number; clock_sources: Record<string, number>;
  };
  metrics: MetricSummary[];
  alerts: { total: number; acknowledged: number; recent: ReportAlert[] };
  model: { version: string | null; target: string | null; estimates: number };
  scope: Record<string, unknown> | undefined;
  frameworks: { code: string; topic: string; use: string }[];
  limitations: string[];
  readings: ReportReading[];
}

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

export function summarizeMetric(key: string, readings: ReportReading[], rules: ReportRule[] = []): MetricSummary {
  const meta = REPORT_METRICS.find(m => m.key === key) || { key, label: key, unit: "" };
  const values = readings.filter(r => r.quality?.invalid !== true)
    .map(r => r.metrics[key]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const sorted = [...values].sort((a, b) => a - b);
  const rule = rules.find(r => r.metric === key && r.enabled);
  const threshold = rule && Number.isFinite(rule.high) ? rule.high : null;
  const danger = rule && typeof rule.danger_high === "number" ? rule.danger_high : null;
  const middle = sorted.length >> 1;
  const latestReading = readings.find(r => r.quality?.invalid !== true && typeof r.metrics[key] === "number");
  return {
    ...meta, count: values.length,
    min: sorted.length ? round(sorted[0]) : null,
    max: sorted.length ? round(sorted[sorted.length - 1]) : null,
    mean: values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null,
    median: sorted.length ? round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) : null,
    latest: latestReading ? round(latestReading.metrics[key] as number) : null,
    threshold, danger,
    above_threshold: threshold === null ? 0 : values.filter(v => v > threshold).length,
    above_danger: danger === null ? 0 : values.filter(v => v > danger).length,
  };
}

export function coverageOf(readings: ReportReading[], limit = 288) {
  const times = readings.map(r => Date.parse(r.observed_at)).filter(Number.isFinite).sort((a, b) => a - b);
  const steps = times.slice(1).map((t, i) => (t - times[i]) / 60000).filter(s => s > 0);
  const sortedSteps = [...steps].sort((a, b) => a - b);
  const median = sortedSteps.length ? sortedSteps[sortedSteps.length >> 1] : null;
  // A gap is a pause longer than three typical intervals (and at least 15 minutes).
  const gapLimit = median === null ? null : Math.max(15, median * 3);
  const gaps = gapLimit === null ? [] : steps.filter(s => s > gapLimit);
  const clock: Record<string, number> = {};
  for (const r of readings) { const source = r.quality?.clock_source || "tidak tercatat"; clock[source] = (clock[source] || 0) + 1; }
  const invalid = readings.filter(r => r.quality?.invalid === true).length;
  return {
    reading_count: readings.length, limit, valid_count: readings.length - invalid, invalid_count: invalid,
    median_interval_minutes: median === null ? null : round(median, 1),
    gaps: gaps.length, longest_gap_minutes: gaps.length ? round(Math.max(...gaps), 0) : null,
    hashed_raw_count: readings.filter(r => typeof r.raw_sha256 === "string" && /^[a-f0-9]{64}$/.test(r.raw_sha256)).length,
    clock_sources: clock,
  };
}

export const FRAMEWORKS = [
  { code: "GRI 305-7", topic: "Emisi udara signifikan", use: "Konteks udara ambien sekitar lokasi, bukan inventaris emisi." },
  { code: "GRI 413", topic: "Masyarakat lokal", use: "Bukti pemantauan yang dapat dibagikan kepada warga sekitar." },
  { code: "GRI 2-5", topic: "Assurance eksternal", use: "Laporan ini belum mendapat assurance independen." },
];

export const LIMITATIONS = [
  "Laporan ini memuat pemantauan udara ambien di titik node, bukan pengukuran emisi cerobong atau inventaris gas rumah kaca.",
  "Debu optik bukan PM2.5 tervalidasi kecuali node ditandai tervalidasi. eCO2 adalah estimasi sensor gas, bukan CO2e.",
  "Hasil model GRU adalah estimasi dan dipisahkan dari pembacaan terukur.",
  "Data tidak menetapkan sumber pencemar, kepatuhan regulasi, skor ESG, atau penurunan emisi.",
  "Sensor berbiaya rendah memerlukan pengujian pembanding sebelum digunakan sebagai dasar keputusan regulasi.",
  "Laporan belum mendapat assurance independen. Maksimal 288 pembacaan terakhir per node.",
];

export function reportId(nodeId: string, generatedAt: Date, digest: string) {
  const stamp = generatedAt.toISOString().slice(0, 10).replace(/-/g, "");
  return `AER-${stamp}-${nodeId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase()}-${digest.slice(0, 6).toUpperCase()}`;
}

export function buildReport(input: {
  node: ReportNode; readings: ReportReading[]; alerts?: ReportAlert[]; scope?: Record<string, unknown>;
  generatedAt?: Date; generatedBy?: string | null; digest?: string;
}): EsgReport {
  const generatedAt = input.generatedAt || new Date();
  const readings = [...input.readings].sort((a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at));
  const from = readings.length ? readings[readings.length - 1].observed_at : null;
  const to = readings.length ? readings[0].observed_at : null;
  const hours = from && to ? round((Date.parse(to) - Date.parse(from)) / 3600000, 1) : null;
  const alerts = [...(input.alerts || [])].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const metrics = REPORT_METRICS
    .filter(m => m.key !== "pm25_ug_m3" || input.node.pm25_validated)
    .map(m => summarizeMetric(m.key, readings, input.node.rules));
  const gru = readings.find(r => r.gru)?.gru || null;
  return {
    report_id: reportId(input.node.id, generatedAt, input.digest || "000000"),
    report_type: "ambient_monitoring",
    generated_at: generatedAt.toISOString(),
    generated_by: input.generatedBy || null,
    node: input.node,
    period: { from, to, hours },
    coverage: coverageOf(readings),
    metrics,
    alerts: { total: alerts.length, acknowledged: alerts.filter(a => a.acknowledged_at).length, recent: alerts.slice(0, 10) },
    model: { version: gru?.model_version || null, target: gru?.target || null, estimates: readings.filter(r => r.gru).length },
    scope: input.scope,
    frameworks: FRAMEWORKS,
    limitations: LIMITATIONS,
    readings,
  };
}

// Stable text that both the JSON file and the PDF fingerprint refer to.
export function readingsFingerprintSource(readings: ReportReading[]) {
  return JSON.stringify(readings.map(r => [r.id, r.observed_at, r.metrics, r.gru, r.raw_sha256 ?? null]));
}

export async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return "";
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

export const formatNumber = (v: number | null | undefined, digits = 2) =>
  typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("id-ID", { maximumFractionDigits: digits }) : "—";
export const formatWhen = (v: string | null | undefined, withYear = true) => {
  const t = v ? Date.parse(v) : NaN;
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "short", ...(withYear ? { year: "numeric" } : {}), hour: "2-digit", minute: "2-digit",
  }) + " WIB";
};
const number = formatNumber;
const when = formatWhen;

export function summarySentence(report: EsgReport): string {
  const c = report.coverage;
  const valid = c.reading_count ? Math.round((c.valid_count / c.reading_count) * 100) : 0;
  const parts = [
    `Selama ${report.period.hours !== null ? number(report.period.hours, 1) + " jam" : "periode tersedia"} (${when(report.period.from)} sampai ${when(report.period.to)}), node ${report.node.name} mencatat ${c.reading_count} pembacaan dengan ${valid}% valid.`,
  ];
  const dust = report.metrics.find(m => m.key === (report.node.pm25_validated ? "pm25_ug_m3" : "dust_ug_m3"));
  if (dust && dust.count) parts.push(`${dust.label} rata-rata ${number(dust.mean)} ${dust.unit} dengan nilai tertinggi ${number(dust.max)} ${dust.unit}.`);
  const exceeded = report.metrics.filter(m => m.above_threshold > 0);
  parts.push(exceeded.length
    ? `Pembacaan di atas ambang node: ${exceeded.map(m => `${m.label} ${m.above_threshold} kali`).join(", ")}.`
    : "Tidak ada pembacaan di atas ambang yang diatur untuk node ini.");
  if (c.gaps) parts.push(`Terdapat ${c.gaps} jeda data, terpanjang sekitar ${number(c.longest_gap_minutes, 0)} menit.`);
  return parts.join(" ");
}


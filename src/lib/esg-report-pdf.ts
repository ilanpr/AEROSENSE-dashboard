// Lays out the structured ambient-monitoring report as an A4 PDF for ESG audit files.
import { PdfDocument, PdfPage, wrapText, type FontName, type Rgb } from "./pdf-writer.ts";
import { formatNumber, formatWhen, summarySentence, type EsgReport, type MetricSummary, type ReportReading } from "./esg-report.ts";

const BRAND: Rgb = [0.027, 0.349, 0.737];
const BRAND_DEEP: Rgb = [0.016, 0.231, 0.541];
const SKY: Rgb = [0.918, 0.953, 0.988];
const INK: Rgb = [0.063, 0.149, 0.247];
const MUTED: Rgb = [0.29, 0.396, 0.518];
const RULE: Rgb = [0.827, 0.89, 0.965];
const WHITE: Rgb = [1, 1, 1];
const WARN: Rgb = [0.651, 0.176, 0.259];
const OK: Rgb = [0.075, 0.478, 0.31];
const ZEBRA: Rgb = [0.965, 0.978, 0.995];

const MARGIN = 46;
const TOP = 70;
const BOTTOM = 790;

const number = formatNumber;
const when = formatWhen;

interface Column { title: string; width: number; align?: "left" | "right"; font?: FontName }

class Layout {
  readonly doc: PdfDocument;
  readonly report: EsgReport;
  readonly digest: string;
  page!: PdfPage;
  y = TOP;
  readonly width: number;

  constructor(report: EsgReport, digest: string) {
    this.report = report;
    this.digest = digest;
    this.doc = new PdfDocument({ title: "Laporan Pemantauan Udara Ambien " + report.report_id, author: "AEROSENSE", subject: "Bukti pendukung audit ESG" });
    this.width = 595.28 - MARGIN * 2;
  }

  newPage(first = false) {
    this.page = this.doc.addPage();
    if (first) {
      this.page.rect(0, 0, this.page.width, 150, { fill: BRAND_DEEP });
      this.page.rect(this.page.width * 0.55, 0, this.page.width * 0.45, 150, { fill: BRAND });
      this.page.text("AEROSENSE", MARGIN, 42, { size: 11, font: "bold", color: WHITE });
      this.page.text("Laporan Pemantauan Udara Ambien", MARGIN, 80, { size: 20, font: "bold", color: WHITE, maxWidth: this.width - 150 });
      this.page.text(this.report.node.name, MARGIN, 102, { size: 13, color: WHITE, maxWidth: this.width * 0.62 });
      this.page.text("Bukti pendukung audit ESG · belum mendapat assurance independen", MARGIN, 126, { size: 9, color: [0.85, 0.92, 1] });
      const right = this.page.width - MARGIN;
      this.page.text("Nomor laporan", right, 30, { size: 7.5, color: [0.85, 0.92, 1], align: "right" });
      this.page.text(this.report.report_id, right, 43, { size: 9.5, font: "bold", color: WHITE, align: "right" });
      this.page.text("Dibuat " + when(this.report.generated_at), right, 56, { size: 7.5, color: [0.85, 0.92, 1], align: "right" });
      this.y = 178;
    } else {
      this.page.text("AEROSENSE", MARGIN, 40, { size: 9, font: "bold", color: BRAND });
      this.page.text("Laporan Pemantauan Udara Ambien · " + this.report.node.name, MARGIN + 64, 40, { size: 8.5, color: MUTED, maxWidth: this.width - 200 });
      this.page.text(this.report.report_id, this.page.width - MARGIN, 40, { size: 8.5, color: MUTED, align: "right" });
      this.page.line(MARGIN, 50, this.page.width - MARGIN, 50, { color: RULE });
      this.y = TOP;
    }
  }

  ensure(height: number) {
    if (this.y + height > BOTTOM) this.newPage();
  }

  heading(title: string, note?: string) {
    this.ensure(44);
    this.y += 8;
    this.page.rect(MARGIN, this.y - 11, 4, 15, { fill: BRAND });
    this.page.text(title, MARGIN + 12, this.y, { size: 13, font: "bold", color: INK });
    if (note) this.page.text(note, this.page.width - MARGIN, this.y, { size: 8, color: MUTED, align: "right" });
    this.y += 16;
  }

  paragraph(text: string, options: { size?: number; color?: Rgb; indent?: number; bullet?: boolean } = {}) {
    const size = options.size ?? 9.5;
    const indent = (options.indent ?? 0) + (options.bullet ? 12 : 0);
    const lines = wrapText(text, this.width - indent, size);
    for (const [index, line] of lines.entries()) {
      this.ensure(size + 5);
      if (options.bullet && index === 0) this.page.dot(MARGIN + indent - 7, this.y - size * 0.33, 1.6, BRAND);
      this.page.text(line, MARGIN + indent, this.y, { size, color: options.color ?? INK });
      this.y += size + 4.5;
    }
  }

  keyValues(rows: [string, string, FontName?][], columns = 2) {
    const colWidth = this.width / columns;
    for (let i = 0; i < rows.length; i += columns) {
      const chunk = rows.slice(i, i + columns);
      const heights = chunk.map(([, value, font]) => wrapText(value, colWidth - 14, 9.5, font || "regular").length);
      const height = 14 + Math.max(...heights) * 12.5;
      this.ensure(height + 4);
      chunk.forEach(([label, value, font], index) => {
        const x = MARGIN + index * colWidth;
        this.page.text(label.toUpperCase(), x, this.y, { size: 7, font: "bold", color: MUTED });
        wrapText(value, colWidth - 14, 9.5, font || "regular").forEach((line, n) =>
          this.page.text(line, x, this.y + 13 + n * 12.5, { size: font === "mono" ? 8 : 9.5, font: font || "regular", color: INK }));
      });
      this.y += height + 6;
    }
  }

  tiles(items: { label: string; value: string; note: string; tone?: Rgb }[]) {
    const gap = 10, height = 62;
    const w = (this.width - gap * (items.length - 1)) / items.length;
    this.ensure(height + 10);
    items.forEach((item, i) => {
      const x = MARGIN + i * (w + gap);
      this.page.rect(x, this.y, w, height, { fill: SKY, stroke: RULE });
      this.page.text(item.label.toUpperCase(), x + 10, this.y + 16, { size: 7, font: "bold", color: MUTED, maxWidth: w - 20 });
      this.page.text(item.value, x + 10, this.y + 38, { size: 17, font: "bold", color: item.tone ?? BRAND, maxWidth: w - 20 });
      this.page.text(item.note, x + 10, this.y + 53, { size: 7.5, color: MUTED, maxWidth: w - 20 });
    });
    this.y += height + 14;
  }

  table(columns: Column[], rows: string[][], options: { size?: number; rowHeight?: number; tones?: (Rgb | null)[] } = {}) {
    const size = options.size ?? 8.5;
    const rowHeight = options.rowHeight ?? 16;
    const scale = this.width / columns.reduce((a, c) => a + c.width, 0);
    const widths = columns.map(c => c.width * scale);
    const drawHeader = () => {
      this.page.rect(MARGIN, this.y, this.width, rowHeight + 2, { fill: BRAND });
      let x = MARGIN;
      columns.forEach((c, i) => {
        const tx = c.align === "right" ? x + widths[i] - 6 : x + 6;
        this.page.text(c.title, tx, this.y + rowHeight - 4, { size: size - 0.5, font: "bold", color: WHITE, align: c.align === "right" ? "right" : "left", maxWidth: widths[i] - 8 });
        x += widths[i];
      });
      this.y += rowHeight + 2;
    };
    this.ensure(rowHeight * 3);
    drawHeader();
    rows.forEach((row, r) => {
      if (this.y + rowHeight > BOTTOM) { this.newPage(); drawHeader(); }
      if (r % 2) this.page.rect(MARGIN, this.y, this.width, rowHeight, { fill: ZEBRA });
      let x = MARGIN;
      row.forEach((cell, i) => {
        const c = columns[i];
        const tx = c.align === "right" ? x + widths[i] - 6 : x + 6;
        this.page.text(cell, tx, this.y + rowHeight - 4.5, { size, font: c.font, color: options.tones?.[r] && i === row.length - 1 ? options.tones[r]! : INK, align: c.align === "right" ? "right" : "left", maxWidth: widths[i] - 8 });
        x += widths[i];
      });
      this.y += rowHeight;
    });
    this.page.line(MARGIN, this.y, MARGIN + this.width, this.y, { color: RULE });
    this.y += 12;
  }

  chart(x: number, y: number, w: number, h: number, metric: MetricSummary, readings: ReportReading[]) {
    const page = this.page;
    page.rect(x, y, w, h, { fill: WHITE, stroke: RULE });
    page.text(metric.label, x + 10, y + 16, { size: 9, font: "bold", color: INK });
    page.text(metric.unit, x + w - 10, y + 16, { size: 8, color: MUTED, align: "right" });
    const points = [...readings].reverse()
      .filter(r => r.quality?.invalid !== true && typeof r.metrics[metric.key] === "number")
      .map(r => ({ t: Date.parse(r.observed_at), v: r.metrics[metric.key] as number }))
      .filter(p => Number.isFinite(p.t));
    const plot = { x: x + 34, y: y + 28, w: w - 46, h: h - 50 };
    if (points.length < 2) {
      page.text("Data belum cukup untuk grafik.", x + w / 2, y + h / 2 + 4, { size: 8, color: MUTED, align: "center" });
      return;
    }
    let lo = Math.min(...points.map(p => p.v)), hi = Math.max(...points.map(p => p.v));
    if (metric.threshold !== null && metric.threshold <= hi * 1.5) hi = Math.max(hi, metric.threshold);
    if (hi === lo) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const t0 = points[0].t, t1 = points[points.length - 1].t || t0 + 1;
    const sx = (t: number) => plot.x + ((t - t0) / Math.max(1, t1 - t0)) * plot.w;
    const sy = (v: number) => plot.y + plot.h - ((v - lo) / (hi - lo)) * plot.h;
    for (const tick of [lo + pad, (lo + hi) / 2, hi - pad]) {
      page.line(plot.x, sy(tick), plot.x + plot.w, sy(tick), { color: [0.93, 0.95, 0.98], width: 0.5 });
      page.text(number(tick, 1), plot.x - 4, sy(tick) + 2.5, { size: 6.5, color: MUTED, align: "right" });
    }
    if (metric.threshold !== null && metric.threshold >= lo && metric.threshold <= hi) {
      page.line(plot.x, sy(metric.threshold), plot.x + plot.w, sy(metric.threshold), { color: WARN, width: 0.8, dash: [3, 2] });
      page.text("Ambang " + number(metric.threshold), plot.x + 3, sy(metric.threshold) - 3, { size: 6.5, color: WARN });
    }
    // Break the line across data gaps so missing periods are not drawn as data.
    const gapMs = Math.max(15, (this.report.coverage.median_interval_minutes ?? 5) * 3) * 60000;
    let run: [number, number][] = [];
    points.forEach((p, i) => {
      if (i && p.t - points[i - 1].t > gapMs) { page.polyline(run, { color: BRAND, width: 1.1 }); run = []; }
      run.push([sx(p.t), sy(p.v)]);
    });
    page.polyline(run, { color: BRAND, width: 1.1 });
    const last = points[points.length - 1];
    page.dot(sx(last.t), sy(last.v), 2.2, BRAND);
    page.text(when(new Date(t0).toISOString(), false), plot.x, y + h - 9, { size: 6.5, color: MUTED });
    page.text(when(new Date(t1).toISOString(), false), plot.x + plot.w, y + h - 9, { size: 6.5, color: MUTED, align: "right" });
  }

  footers() {
    const total = this.doc.pages.length;
    this.doc.pages.forEach((page, i) => {
      page.line(MARGIN, 806, page.width - MARGIN, 806, { color: RULE });
      page.text("Dokumen pendukung audit ESG. Tidak menetapkan kepatuhan, skor ESG, atau sumber pencemar.", MARGIN, 820, { size: 7, color: MUTED });
      page.text(`Halaman ${i + 1} dari ${total}`, page.width - MARGIN, 820, { size: 7, color: MUTED, align: "right" });
    });
  }
}

export function renderEsgReportPdf(report: EsgReport, digest: string): Uint8Array {
  const L = new Layout(report, digest);
  const c = report.coverage;
  const metricsAbove = report.metrics.reduce((a, m) => a + m.above_threshold, 0);
  const valid = c.reading_count ? Math.round((c.valid_count / c.reading_count) * 100) : 0;
  L.newPage(true);

  L.heading("Ringkasan");
  L.tiles([
    { label: "Pembacaan", value: String(c.reading_count), note: `dari maksimal ${c.limit} terakhir` },
    { label: "Data valid", value: valid + "%", note: `${c.invalid_count} ditandai tidak valid`, tone: valid >= 90 ? OK : WARN },
    { label: "Di atas ambang", value: String(metricsAbove), note: "jumlah pembacaan", tone: metricsAbove ? WARN : OK },
    { label: "Peringatan", value: String(report.alerts.total), note: `${report.alerts.acknowledged} sudah ditinjau` },
  ]);
  L.paragraph(summarySentence(report));
  L.y += 6;

  L.heading("Identitas laporan");
  L.keyValues([
    ["Nomor laporan", report.report_id],
    ["Dibuat", when(report.generated_at) + (report.generated_by ? " oleh " + report.generated_by : "")],
    ["Node", `${report.node.name} (${report.node.id})`],
    ["Koordinat node", `${number(report.node.latitude, 5)}, ${number(report.node.longitude, 5)}`],
    ["Periode data", `${when(report.period.from)} sampai ${when(report.period.to)}`],
    ["Gateway · kalibrasi", `${report.node.gateway_id || "—"} · ${report.node.calibration_version || "belum tercatat"}`],
    ["PM2.5", report.node.pm25_validated ? "Tervalidasi untuk node ini" : "Belum tervalidasi. Debu optik dilaporkan terpisah."],
    ["Status assurance", "Belum mendapat assurance independen"],
  ]);
  L.keyValues([["Sidik jari data (SHA-256)", digest || "Tidak tersedia di peramban ini", "mono"]], 1);
  L.paragraph("Sidik jari dihitung dari daftar pembacaan dan sama dengan nilai readings_sha256 pada file JSON. Nilai yang berbeda berarti data telah berubah.", { size: 8, color: MUTED });

  L.heading("Statistik parameter", "Pembacaan valid saja");
  L.table([
    { title: "Parameter", width: 92 }, { title: "Satuan", width: 44 }, { title: "n", width: 30, align: "right" },
    { title: "Min", width: 42, align: "right" }, { title: "Median", width: 46, align: "right" }, { title: "Rata-rata", width: 50, align: "right" },
    { title: "Maks", width: 42, align: "right" }, { title: "Terakhir", width: 46, align: "right" }, { title: "Ambang", width: 46, align: "right" },
    { title: "> Ambang", width: 46, align: "right" },
  ], report.metrics.map(m => [m.label, m.unit, String(m.count), number(m.min), number(m.median), number(m.mean), number(m.max), number(m.latest),
    m.threshold === null ? "—" : number(m.threshold), m.threshold === null ? "—" : String(m.above_threshold)]),
  { tones: report.metrics.map(m => m.above_threshold ? WARN : null) });

  L.heading("Cakupan dan mutu data");
  const clocks = Object.entries(c.clock_sources).map(([k, v]) => `${k === "sensor" ? "jam sensor" : k === "gateway" ? "jam gateway" : k} ${v}`).join(", ") || "—";
  L.table([{ title: "Pemeriksaan", width: 200 }, { title: "Hasil", width: 300 }], [
    ["Interval pembacaan umum", c.median_interval_minutes === null ? "—" : number(c.median_interval_minutes, 1) + " menit"],
    ["Jeda data (> 3 kali interval)", c.gaps ? `${c.gaps} jeda, terpanjang ${number(c.longest_gap_minutes, 0)} menit` : "Tidak ada"],
    ["Pembacaan ditandai tidak valid", `${c.invalid_count} dari ${c.reading_count}`],
    ["Pembacaan dengan hash data mentah", `${c.hashed_raw_count} dari ${c.reading_count}`],
    ["Sumber waktu", clocks],
    ["Model estimasi GRU", report.model.version ? `${report.model.version} · target ${report.model.target} · ${report.model.estimates} estimasi` : "Tidak ada hasil model"],
  ]);

  L.heading("Peringatan tercatat", `${report.alerts.total} total`);
  if (report.alerts.recent.length) {
    L.table([{ title: "Waktu", width: 130 }, { title: "Parameter", width: 110 }, { title: "Nilai", width: 80, align: "right" },
      { title: "Ambang", width: 80, align: "right" }, { title: "Status", width: 100 }],
    report.alerts.recent.map(a => [when(a.created_at), (report.metrics.find(m => m.key === a.metric)?.label || a.metric), number(a.value) + " " + a.unit, number(a.threshold) + " " + a.unit,
      a.acknowledged_at ? "Sudah ditinjau" : "Belum ditinjau"]),
    { tones: report.alerts.recent.map(a => a.acknowledged_at ? OK : WARN) });
  } else L.paragraph("Tidak ada peringatan tersimpan untuk node ini.", { color: MUTED });

  L.heading("Tren pembacaan");
  const charts = report.metrics.filter(m => m.count > 0);
  const gap = 12, cw = (L.width - gap) / 2, ch = 128;
  for (let i = 0; i < charts.length; i += 2) {
    L.ensure(ch + gap);
    L.chart(MARGIN, L.y, cw, ch, charts[i], report.readings);
    if (charts[i + 1]) L.chart(MARGIN + cw + gap, L.y, cw, ch, charts[i + 1], report.readings);
    L.y += ch + gap;
  }
  L.paragraph("Garis putus merah menunjukkan ambang peringatan node. Garis terputus berarti tidak ada pembacaan pada periode tersebut.", { size: 8, color: MUTED });

  L.heading("Kerangka acuan");
  L.table([{ title: "Acuan", width: 70, font: "bold" }, { title: "Topik", width: 120 }, { title: "Penggunaan dalam laporan ini", width: 320 }],
    report.frameworks.map(f => [f.code, f.topic, f.use]), { rowHeight: 18 });

  L.heading("Batasan penggunaan");
  for (const item of report.limitations) L.paragraph(item, { bullet: true, size: 9 });
  L.y += 6;

  L.heading("Lembar verifikasi");
  L.ensure(120);
  const boxW = (L.width - 14) / 2;
  for (const [i, title] of ["Disusun oleh", "Diperiksa oleh"].entries()) {
    const x = MARGIN + i * (boxW + 14);
    L.page.rect(x, L.y, boxW, 108, { stroke: RULE });
    L.page.text(title.toUpperCase(), x + 12, L.y + 18, { size: 7.5, font: "bold", color: MUTED });
    ["Nama", "Jabatan", "Tanggal", "Tanda tangan"].forEach((field, n) => {
      const ly = L.y + 40 + n * 20;
      L.page.text(field, x + 12, ly, { size: 8.5, color: MUTED });
      L.page.line(x + 78, ly + 2, x + boxW - 12, ly + 2, { color: RULE });
    });
  }
  L.y += 122;

  L.newPage();
  L.heading("Lampiran A · Pembacaan lengkap", `${report.readings.length} baris, terbaru di atas`);
  const shown = report.metrics;
  L.table([
    { title: "Waktu (WIB)", width: 98 },
    ...shown.map(m => ({ title: `${m.label.replace(" tervalidasi", "").replace("Kelembapan", "RH").replace("Debu optik", "Debu")} (${m.unit})`, width: 58, align: "right" as const })),
    { title: "GRU", width: 50, align: "right" }, { title: "Status", width: 50 },
  ], report.readings.map(r => [
    when(r.observed_at),
    ...shown.map(m => number(r.metrics[m.key])),
    r.gru ? number(r.gru.value) : "—",
    r.quality?.invalid ? "Tidak valid" : "Valid",
  ]), { size: 7.5, rowHeight: 13, tones: report.readings.map(r => r.quality?.invalid ? WARN : null) });
  L.paragraph("GRU adalah estimasi model untuk target " + (report.model.target || "—") + " dan tidak menggantikan pembacaan terukur.", { size: 8, color: MUTED });

  L.footers();
  return L.doc.save();
}


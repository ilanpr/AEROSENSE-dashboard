// Lays out the structured ambient-monitoring report as an A4 PDF for ESG audit files.
import { PdfDocument, PdfPage, wrapText, type FontName, type Rgb } from "./pdf-writer.ts";
import { formatNumber, formatWhen, summarySentence, type EsgReport, type MetricSummary, type ReportReading } from "./esg-report.ts";

const BRAND: Rgb = [0.027, 0.349, 0.737];
const SKY: Rgb = [0.918, 0.953, 0.988];
const INK: Rgb = [0.063, 0.149, 0.247];
const MUTED: Rgb = [0.29, 0.396, 0.518];
const RULE: Rgb = [0.827, 0.89, 0.965];
const WHITE: Rgb = [1, 1, 1];
const WARN: Rgb = [0.651, 0.176, 0.259];
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
      this.page.rect(0, 0, this.page.width, 7, { fill: BRAND });
      this.page.text("AEROSENSE", MARGIN, 40, { size: 12, font: "bold", color: BRAND });
      const right=this.page.width-MARGIN;
      this.page.text(this.report.report_id, right, 34, { size:8, color:MUTED, align:"right" });
      this.page.text(when(this.report.generated_at),right,47,{size:8,color:MUTED,align:"right"});
      this.page.text("Laporan pemantauan",MARGIN,91,{size:25,font:"bold",color:INK});
      this.page.text("udara ambien",MARGIN,121,{size:25,font:"bold",color:INK});
      this.page.text(this.report.node.name,MARGIN,147,{size:12,color:BRAND,maxWidth:this.width});
      this.y=168;
      if(this.report.recipient){
        this.page.text("Disampaikan kepada",MARGIN,this.y,{size:8,color:MUTED});this.y+=16;
        for(const line of wrapText(this.report.recipient,this.width,11,"bold")){this.page.text(line,MARGIN,this.y,{size:11,font:"bold",color:INK});this.y+=14;}
        this.y+=8;
      }
      if(this.report.scope?.type==="synthetic_demo"){
        this.page.text("DATA SIMULASI - bukan hasil pengukuran lapangan",MARGIN,this.y,{size:8,font:"bold",color:WARN});this.y+=18;
      }
      this.page.line(MARGIN,this.y,this.page.width-MARGIN,this.y,{color:RULE});this.y+=22;
    } else {
      this.page.text("AEROSENSE", MARGIN, 40, { size: 9, font: "bold", color: BRAND });
      this.page.text("Pemantauan udara ambien", MARGIN + 80, 40, { size: 8.5, color: MUTED });
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
    this.page.text(title, MARGIN, this.y, { size: 13, font: "bold", color: INK });
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

  table(columns: Column[], rows: string[][], options: { size?: number; rowHeight?: number; tones?: (Rgb | null)[] } = {}) {
    const size = options.size ?? 8.5;
    const rowHeight = options.rowHeight ?? 16;
    const scale = this.width / columns.reduce((a, c) => a + c.width, 0);
    const widths = columns.map(c => c.width * scale);
    const headerHeight=Math.max(rowHeight+6,...columns.map((c,i)=>wrapText(c.title,widths[i]-12,size-0.5,"bold").length*(size+3)+12));
    const drawHeader = () => {
      this.page.rect(MARGIN,this.y,this.width,headerHeight,{fill:SKY});
      let x=MARGIN;
      columns.forEach((c,i)=>{
        const tx=c.align==="right"?x+widths[i]-6:x+6;
        wrapText(c.title,widths[i]-12,size-0.5,"bold").forEach((line,n)=>this.page.text(line,tx,this.y+12+n*(size+3),{size:size-0.5,font:"bold",color:INK,align:c.align||"left"}));
        x+=widths[i];
      });
      this.y+=headerHeight;
    };
    this.ensure(rowHeight * 3);
    drawHeader();
    rows.forEach((row,r)=>{
      const lines=row.map((cell,i)=>wrapText(cell,widths[i]-12,size,columns[i].font));
      const height=Math.max(rowHeight,Math.max(...lines.map(l=>l.length))*(size+3)+12);
      if(this.y+height>BOTTOM){this.newPage();drawHeader();}
      if(r%2)this.page.rect(MARGIN,this.y,this.width,height,{fill:ZEBRA});
      let x=MARGIN;
      lines.forEach((cell,i)=>{
        const c=columns[i],tx=c.align==="right"?x+widths[i]-6:x+6;
        cell.forEach((line,n)=>this.page.text(line,tx,this.y+12+n*(size+3),{size,font:c.font,color:options.tones?.[r]&&i===row.length-1?options.tones[r]!:INK,align:c.align||"left"}));
        x+=widths[i];
      });
      this.y+=height;
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
      page.text("AEROSENSE | Laporan pemantauan lingkungan", MARGIN, 820, { size: 7, color: MUTED });
      page.text(`Halaman ${i + 1} dari ${total}`, page.width - MARGIN, 820, { size: 7, color: MUTED, align: "right" });
    });
  }
}

export function renderEsgReportPdf(report: EsgReport, digest: string): Uint8Array {
  const L=new Layout(report,digest),c=report.coverage;
  L.newPage(true);
  L.keyValues([
    ["Mulai pengamatan",when(report.period.from)],
    ["Akhir pengamatan",when(report.period.to)],
    ["Lokasi",`${number(report.node.latitude,5)}, ${number(report.node.longitude,5)}`],
    ["Cakupan data",`${c.reading_count} pengamatan | ${c.valid_count} lolos pemeriksaan`],
  ]);
  L.heading("Hasil pemantauan");
  L.paragraph(summarySentence(report));L.y+=10;
  L.table([
    {title:"Parameter",width:112},{title:"Satuan",width:44},
    {title:"Rata-rata",width:60,align:"right"},{title:"Min",width:46,align:"right"},
    {title:"Maks",width:46,align:"right"},{title:"Terakhir",width:57,align:"right"},
    {title:"Ambang",width:55,align:"right"},{title:"Pelampauan",width:67,align:"right"},
  ],report.metrics.filter(m=>m.count>0).map(m=>[
    m.label,m.unit,number(m.mean),number(m.min),number(m.max),number(m.latest),
    m.threshold===null?"-":number(m.threshold),m.threshold===null?"-":String(m.above_threshold),
  ]),{size:8.5,rowHeight:27,tones:report.metrics.filter(m=>m.count>0).map(m=>m.above_threshold?WARN:null)});
  L.paragraph("Ambang mengikuti konfigurasi node. Statistik hanya menggunakan pembacaan yang lolos pemeriksaan kualitas.",{size:8,color:MUTED});
  L.heading("Peringatan & kualitas data");
  L.keyValues([
    ["Peringatan tercatat",`${report.alerts.total} peringatan | ${report.alerts.acknowledged} ditinjau`],
    ["Pemeriksaan kualitas",`${c.invalid_count} pembacaan tidak valid | ${c.gaps} jeda data`],
  ]);
  if(report.alerts.recent.length)L.table([
    {title:"Waktu (WIB)",width:120},{title:"Parameter",width:120},{title:"Nilai",width:85,align:"right"},
    {title:"Ambang",width:85,align:"right"},{title:"Peninjauan",width:93},
  ],report.alerts.recent.slice(0,5).map(a=>[when(a.created_at),report.metrics.find(m=>m.key===a.metric)?.label||a.metric,number(a.value)+" "+a.unit,number(a.threshold)+" "+a.unit,a.acknowledged_at?"Ditinjau":"Menunggu"]),{size:8});
  const charts=report.metrics.filter(m=>m.count>=2);
  if(charts.length){
    L.newPage();L.heading("Tren parameter",report.node.name);
    L.paragraph(`${when(report.period.from)} - ${when(report.period.to)}`,{size:8,color:MUTED});L.y+=12;
    const gap=14,cw=(L.width-gap)/2,ch=148;
    for(let i=0;i<charts.length;i+=2){
      L.ensure(ch+gap);L.chart(MARGIN,L.y,cw,ch,charts[i],report.readings);
      if(charts[i+1])L.chart(MARGIN+cw+gap,L.y,cw,ch,charts[i+1],report.readings);
      L.y+=ch+gap;
    }
    L.paragraph("Garis merah: ambang node. Putusnya garis: jeda pengamatan. Data mentah tersedia pada ekspor terpisah.",{size:8,color:MUTED});
  }
  L.heading("Catatan laporan");
  L.paragraph("Pemantauan udara ambien pada titik pemasangan; bukan inventaris emisi atau penetapan kepatuhan dan sumber pencemar. Verifikasi independen tidak termasuk dalam laporan.",{size:8,color:MUTED});
  if(!report.node.pm25_validated)L.paragraph("Debu optik dilaporkan sebagai indikator sensor, bukan PM2.5 tervalidasi.",{size:8,color:MUTED});
  L.paragraph("eCO2 adalah estimasi sensor gas, bukan CO2e inventaris gas rumah kaca.",{size:8,color:MUTED});
  L.y+=10;
  L.keyValues([["Identitas node",report.node.id],["Kalibrasi",report.node.calibration_version||"Tidak tercatat"]]);
  L.ensure(45);L.page.text("VERIFIKASI DATA | SHA-256",MARGIN,L.y,{size:7,font:"bold",color:MUTED});L.y+=12;
  const hash=digest||"Tidak tersedia";
  for(const line of wrapText(hash,L.width,7.5,"mono")){L.page.text(line,MARGIN,L.y,{size:7.5,font:"mono",color:MUTED});L.y+=11;}
  L.footers();return L.doc.save();
}

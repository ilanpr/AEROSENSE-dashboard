// Minimal dependency-free PDF writer: A4 pages, the built-in Helvetica and Courier
// fonts (WinAnsi encoding), text, rectangles, lines and polylines. Coordinates are in
// points with the origin at the top-left corner of the page.

export type Rgb = [number, number, number];
export type FontName = "regular" | "bold" | "mono";

const PAGE_W = 595.28;
const PAGE_H = 841.89;

// Advance widths (1/1000 em) for ASCII 32..126 from the standard Helvetica metrics.
const HELVETICA = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HELVETICA_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

const WIN_ANSI: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94,
  "•": 0x95, "–": 0x96, "—": 0x97, "™": 0x99,
};
const REPLACE: Record<string, string> = { "₂": "2", "≥": ">=", "≤": "<=", "→": "->", "←": "<-", "≈": "~", "×": "x", " ": " " };

// Converts text to WinAnsi bytes held in a JS string (one char per byte).
export function winAnsi(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    if (REPLACE[ch] !== undefined) { out += REPLACE[ch]; continue; }
    const code = ch.codePointAt(0)!;
    if (WIN_ANSI[ch] !== undefined) out += String.fromCharCode(WIN_ANSI[ch]);
    else if ((code >= 32 && code < 127) || (code >= 0xa0 && code <= 0xff)) out += ch;
    else if (code === 9) out += " ";
    else out += "?";
  }
  return out;
}

function escapePdf(bytes: string) {
  return bytes.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function textWidth(text: string, size: number, font: FontName = "regular"): number {
  if (font === "mono") return winAnsi(text).length * 600 * size / 1000;
  const table = font === "bold" ? HELVETICA_BOLD : HELVETICA;
  let total = 0;
  for (const ch of winAnsi(text)) {
    const code = ch.charCodeAt(0);
    total += code >= 32 && code <= 126 ? table[code - 32] : 556;
  }
  return total * size / 1000;
}

export function wrapText(text: string, width: number, size: number, font: FontName = "regular"): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? line + " " + word : word;
      if (textWidth(next, size, font) <= width || !line) line = next;
      else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

const color = (c: Rgb) => c.map(v => (Math.round(v * 1000) / 1000).toString()).join(" ");
const num = (v: number) => (Math.round(v * 100) / 100).toString();

export interface TextOptions { size?: number; font?: FontName; color?: Rgb; align?: "left" | "right" | "center"; maxWidth?: number }

export class PdfPage {
  readonly width = PAGE_W;
  readonly height = PAGE_H;
  readonly ops: string[] = [];

  text(value: string, x: number, y: number, options: TextOptions = {}) {
    const size = options.size ?? 10;
    const font = options.font ?? "regular";
    let content = value;
    if (options.maxWidth && textWidth(content, size, font) > options.maxWidth) {
      while (content.length > 1 && textWidth(content + "…", size, font) > options.maxWidth) content = content.slice(0, -1);
      content = content.trimEnd() + "…";
    }
    const w = textWidth(content, size, font);
    const left = options.align === "right" ? x - w : options.align === "center" ? x - w / 2 : x;
    const fontRef = font === "bold" ? "F2" : font === "mono" ? "F3" : "F1";
    this.ops.push(`BT /${fontRef} ${num(size)} Tf ${color(options.color ?? [0, 0, 0])} rg ${num(left)} ${num(PAGE_H - y)} Td (${escapePdf(winAnsi(content))}) Tj ET`);
    return w;
  }

  rect(x: number, y: number, w: number, h: number, options: { fill?: Rgb; stroke?: Rgb; lineWidth?: number } = {}) {
    const parts = ["q"];
    if (options.fill) parts.push(color(options.fill) + " rg");
    if (options.stroke) parts.push(color(options.stroke) + " RG " + num(options.lineWidth ?? 0.6) + " w");
    parts.push(`${num(x)} ${num(PAGE_H - y - h)} ${num(w)} ${num(h)} re`);
    parts.push(options.fill && options.stroke ? "B" : options.fill ? "f" : "S", "Q");
    this.ops.push(parts.join(" "));
  }

  line(x1: number, y1: number, x2: number, y2: number, options: { color?: Rgb; width?: number; dash?: number[] } = {}) {
    this.ops.push(`q ${color(options.color ?? [0, 0, 0])} RG ${num(options.width ?? 0.6)} w ${options.dash ? "[" + options.dash.join(" ") + "] 0 d " : ""}${num(x1)} ${num(PAGE_H - y1)} m ${num(x2)} ${num(PAGE_H - y2)} l S Q`);
  }

  polyline(points: [number, number][], options: { color?: Rgb; width?: number } = {}) {
    if (points.length < 2) return;
    const path = points.map(([x, y], i) => `${num(x)} ${num(PAGE_H - y)} ${i ? "l" : "m"}`).join(" ");
    this.ops.push(`q ${color(options.color ?? [0, 0, 0])} RG ${num(options.width ?? 1)} w 1 j 1 J ${path} S Q`);
  }

  dot(x: number, y: number, r: number, fill: Rgb) {
    const k = 0.5523 * r, cy = PAGE_H - y;
    this.ops.push(`q ${color(fill)} rg ${num(x + r)} ${num(cy)} m ${num(x + r)} ${num(cy + k)} ${num(x + k)} ${num(cy + r)} ${num(x)} ${num(cy + r)} c ${num(x - k)} ${num(cy + r)} ${num(x - r)} ${num(cy + k)} ${num(x - r)} ${num(cy)} c ${num(x - r)} ${num(cy - k)} ${num(x - k)} ${num(cy - r)} ${num(x)} ${num(cy - r)} c ${num(x + k)} ${num(cy - r)} ${num(x + r)} ${num(cy - k)} ${num(x + r)} ${num(cy)} c f Q`);
  }
}

export class PdfDocument {
  readonly pages: PdfPage[] = [];
  readonly info: { title: string; author?: string; subject?: string };
  constructor(info: { title: string; author?: string; subject?: string } = { title: "Dokumen" }) { this.info = info; }

  addPage() {
    const page = new PdfPage();
    this.pages.push(page);
    return page;
  }

  save(): Uint8Array {
    const objects: string[] = [];
    const add = (body: string) => { objects.push(body); return objects.length; };
    const catalog = add("");
    const pagesRef = add("");
    const fonts = [
      add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
      add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"),
      add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>"),
    ];
    const pageRefs: number[] = [];
    for (const page of this.pages) {
      const stream = page.ops.join("\n");
      const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      pageRefs.push(add(`<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${num(PAGE_W)} ${num(PAGE_H)}] /Resources << /Font << /F1 ${fonts[0]} 0 R /F2 ${fonts[1]} 0 R /F3 ${fonts[2]} 0 R >> >> /Contents ${content} 0 R >>`));
    }
    objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesRef} 0 R >>`;
    objects[pagesRef - 1] = `<< /Type /Pages /Kids [${pageRefs.map(r => r + " 0 R").join(" ")}] /Count ${pageRefs.length} >>`;
    const info = add(`<< /Title (${escapePdf(winAnsi(this.info.title))}) /Author (${escapePdf(winAnsi(this.info.author || "AEROSENSE"))}) /Subject (${escapePdf(winAnsi(this.info.subject || ""))}) /Producer (AEROSENSE) >>`);
    let out = "%PDF-1.4\n%âãÏÓ\n";
    const offsets: number[] = [];
    objects.forEach((body, index) => { offsets.push(out.length); out += `${index + 1} 0 obj\n${body}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("");
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}

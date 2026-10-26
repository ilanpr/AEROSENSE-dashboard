import { useMemo, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { downloadCsv, readingsCsv } from "@/lib/csv-export";
import type { Alert, LiveNode, Reading } from "@/types/live.types";
import {
  buildReport, formatNumber, formatWhen, readingsFingerprintSource, sha256Hex, summarySentence, type EsgReport,
} from "@/lib/esg-report";
import "@/styles/esg-report.css";

function download(bytes: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function EsgReportPanel({ node, readings, alerts, scope, userEmail, loading }: {
  node: LiveNode; readings: Reading[]; alerts: Alert[]; scope?: Record<string, unknown>; userEmail?: string | null; loading: boolean;
}) {
  const [busy, setBusy] = useState<"pdf" | "json" | null>(null);
  const [status, setStatus] = useState("");
  const [recipient, setRecipient] = useState("");
  const preview = useMemo(() => readings.length ? buildReport({ node, readings, alerts, scope }) : null, [node, readings, alerts, scope]);

  async function prepare(): Promise<{ report: EsgReport; digest: string }> {
    const digest = await sha256Hex(readingsFingerprintSource(readings));
    return { report: buildReport({ node, readings, alerts, scope, generatedBy: userEmail || null, recipient, digest }), digest };
  }

  async function exportPdf() {
    setBusy("pdf");
    setStatus("");
    try {
      const { report, digest } = await prepare();
      const { renderEsgReportPdf } = await import("@/lib/esg-report-pdf");
      download(renderEsgReportPdf(report, digest) as BlobPart, "application/pdf", report.report_id + ".pdf");
      setStatus(`PDF ${report.report_id} diunduh.`);
    } catch (error) {
      setStatus(error instanceof Error ? "PDF belum dapat dibuat: " + error.message : "PDF belum dapat dibuat.");
    } finally { setBusy(null); }
  }

  async function exportJson() {
    setBusy("json");
    setStatus("");
    try {
      const { report, digest } = await prepare();
      download(JSON.stringify({ ...report, readings_sha256: digest || null }, null, 2), "application/json", report.report_id + ".json");
      setStatus(`JSON ${report.report_id} diunduh.`);
    } catch (error) {
      setStatus(error instanceof Error ? "JSON belum dapat dibuat: " + error.message : "JSON belum dapat dibuat.");
    } finally { setBusy(null); }
  }

  const c = preview?.coverage;
  const valid = c && c.reading_count ? Math.round((c.valid_count / c.reading_count) * 100) : 0;
  const above = preview ? preview.metrics.reduce((a, m) => a + m.above_threshold, 0) : 0;
  const disabled = !preview || loading || !!busy;

  return (
    <section className="live-panel esg-report" aria-labelledby="esg-report-title">
      <div className="esg-report-head">
        <div>
          <h2 id="esg-report-title">Hasil pemantauan</h2>
          <p>{preview ? preview.period.from === preview.period.to ? formatWhen(preview.period.to) : `${formatWhen(preview.period.from)} – ${formatWhen(preview.period.to)}` : "Menunggu riwayat pembacaan node."}</p>
        </div>
        <div className="esg-report-actions">
          <button className="live-button" type="button" onClick={exportPdf} disabled={disabled}>
            {busy === "pdf" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            Unduh PDF laporan
          </button>
          <button className="live-button secondary" type="button" disabled={disabled} onClick={() => downloadCsv(readingsCsv(node, readings, true), `aerosense-pembacaan-${node.id}.csv`)}><Download size={15} />Unduh CSV</button>

        </div>
      </div>

      <label className="esg-recipient">Perusahaan penerima<input value={recipient} onChange={e=>setRecipient(e.target.value)} maxLength={160} placeholder="Nama perusahaan (opsional)" /></label>

      {preview && c ? (
        <>
          <div className="esg-report-tiles">
            <div><span>Pembacaan</span><strong>{c.reading_count}</strong><small>pengamatan tercatat</small></div>
            <div data-tone={valid >= 90 ? "ok" : "warn"}><span>Data valid</span><strong>{valid}%</strong><small>{c.invalid_count} ditandai tidak valid</small></div>
            <div data-tone={above ? "warn" : "ok"}><span>Pelampauan</span><strong>{above}</strong><small>jumlah pembacaan</small></div>
            <div><span>Peringatan</span><strong>{preview.alerts.total}</strong><small>{preview.alerts.acknowledged} sudah ditinjau</small></div>
          </div>
          <p className="esg-report-summary">{summarySentence(preview)}</p>
          <div className="live-table-wrap">
            <table className="live-table esg-report-table">
              <caption>Statistik parameter dari pembacaan valid</caption>
              <thead>
                <tr><th>Parameter</th><th>Min</th><th>Rata-rata</th><th>Maks</th><th>Terakhir</th><th>Ambang</th><th>Di atas ambang</th></tr>
              </thead>
              <tbody>
                {preview.metrics.map(m => (
                  <tr key={m.key}>
                    <td><strong>{m.label}</strong><small>{m.unit} · {m.count} data</small></td>
                    <td>{formatNumber(m.min)}</td>
                    <td>{formatNumber(m.mean)}</td>
                    <td>{formatNumber(m.max)}</td>
                    <td>{formatNumber(m.latest)}</td>
                    <td>{m.threshold === null ? "—" : formatNumber(m.threshold)}</td>
                    <td data-tone={m.above_threshold ? "warn" : undefined}>{m.threshold === null ? "—" : m.above_threshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="esg-report-contents"><summary>Kualitas & berkas data</summary>
          <dl className="esg-report-quality">
            <div><dt>Interval umum</dt><dd>{c.median_interval_minutes === null ? "—" : formatNumber(c.median_interval_minutes, 1) + " menit"}</dd></div>
            <div><dt>Jeda data</dt><dd>{c.gaps ? `${c.gaps} jeda · terpanjang ${formatNumber(c.longest_gap_minutes, 0)} menit` : "Tidak ada"}</dd></div>
            <div><dt>Hash data mentah</dt><dd>{c.hashed_raw_count} dari {c.reading_count} pembacaan</dd></div>
            <div><dt>Model GRU</dt><dd>{preview.model.version ? `${preview.model.version} · ${preview.model.estimates} estimasi` : "Tidak ada"}</dd></div>
          </dl>
          <p>PDF memuat hasil parameter, peringatan, dan tren jika tersedia. Ekspor data menyertakan pembacaan lengkap serta identitas verifikasinya.</p>
          <button className="esg-data-export" type="button" onClick={exportJson} disabled={disabled}>
            {busy === "json" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Ekspor JSON
          </button>
          </details>
        </>
      ) : (
        <p className="live-notice">{loading ? "Memuat riwayat pembacaan…" : "Belum ada pembacaan untuk dilaporkan pada node ini."}</p>
      )}
      {status && <p className="esg-report-status" role="status">{status}</p>}
    </section>
  );
}

import { SprinklerControl } from "@/components/live/SprinklerControl";
import { useState } from "react";
import { Link } from "react-router-dom";
import { FileSpreadsheet, LockKeyhole, MapPin, Save, Settings2, ArrowUpRight, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLiveData } from "@/hooks/useLiveData";
import { DataState } from "@/components/shared/DataState";
import { MonitoringSelect } from "@/components/shared/MonitoringSelect";
import { api } from "@/services/api";
import { downloadCsv, rulesCsv, type ExportRule } from "@/lib/csv-export";
import { metricLabels, type LiveNode } from "@/types/live.types";
import "@/styles/management.css";

interface Rule extends ExportRule { id: string }

function ThresholdEditor({ node, metric, rule, onSaved, onEdited }: { node: LiveNode; metric: string; rule?: Rule; onSaved: () => void; onEdited: () => void }) {
  const [high, setHigh] = useState(rule ? String(rule.high) : "");
  const [danger, setDanger] = useState(rule?.danger_high != null ? String(rule.danger_high) : "");
  const [clear, setClear] = useState(rule ? String(rule.clear_below) : "");
  const [minutes, setMinutes] = useState(String((rule?.cooldown_seconds || 1800) / 60));
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, unit] = metricLabels[metric];
  return <form className="threshold-editor" onSubmit={async e => {
    e.preventDefault(); setError(""); onEdited();
    const warn = Number(high), critical = Number(danger), recovery = Number(clear), cooldown = Number(minutes) * 60;
    if (![high, danger, clear, minutes].every(v => v.trim()) || ![warn, critical, recovery, cooldown].every(Number.isFinite)) { setError("Lengkapi semua nilai ambang dan jeda notifikasi."); return; }
    if (critical <= warn) { setError("Ambang bahaya harus lebih besar daripada ambang waspada."); return; }
    if (recovery >= warn) { setError("Batas pulih harus lebih kecil daripada ambang waspada."); return; }
    if (!Number.isInteger(cooldown) || cooldown < 60 || cooldown > 86400) { setError("Jeda notifikasi harus berada antara 1 dan 1.440 menit."); return; }
    setBusy(true);
    try { await api.post("/v1/rules", { node_id: node.id, metric, high: warn, danger_high: critical, clear_below: recovery, unit, cooldown_seconds: cooldown, enabled }); onSaved(); }
    catch (err) { setError(err instanceof Error ? err.message : "Ambang belum dapat disimpan. Coba kembali."); }
    finally { setBusy(false); }
  }}>
    <div className="threshold-form-heading"><div><h3>Ambang {metricLabels[metric][0]}</h3><p>Atur batas operasional untuk perangkat ini.</p></div><span>{unit}</span></div>
    <div className="threshold-inputs">
      <label>Ambang waspada <span>({unit})</span><input type="number" step="any" required value={high} onChange={e => { setHigh(e.target.value); onEdited(); }} disabled={busy} /></label>
      <label>Ambang bahaya <span>({unit})</span><input type="number" step="any" required value={danger} onChange={e => { setDanger(e.target.value); onEdited(); }} disabled={busy} /></label>
      <label>Batas pulih <span>({unit})</span><input type="number" step="any" required value={clear} onChange={e => { setClear(e.target.value); onEdited(); }} disabled={busy} /><small>Lebih rendah dari ambang waspada agar status tidak berganti terlalu sering.</small></label>
      <label>Jeda notifikasi <span>(menit)</span><input type="number" min="1" max="1440" step="1" required value={minutes} onChange={e => { setMinutes(e.target.value); onEdited(); }} disabled={busy} /><small>Jeda antarperingatan berulang pada parameter yang sama.</small></label>
    </div>
    <div className="threshold-scale" aria-label="Urutan status berdasarkan ambang"><span>Di bawah waspada<strong>{high.trim() ? `< ${high} ${unit}` : "Belum diatur"}</strong></span><span>Waspada<strong>{high.trim() ? `≥ ${high} ${unit}` : "Belum diatur"}</strong></span><span>Bahaya<strong>{danger.trim() ? `≥ ${danger} ${unit}` : "Belum diatur"}</strong></span></div>
    <label className="threshold-enable"><input type="checkbox" checked={enabled} onChange={e => { setEnabled(e.target.checked); onEdited(); }} disabled={busy} /><span>Aktifkan peringatan untuk parameter ini</span></label>
    {error && <p className="threshold-error" role="alert">{error}</p>}
    <button className="live-button" type="submit" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{busy ? "Menyimpan…" : "Simpan ambang"}</button>
  </form>;
}

export function ManagementPage() {
  const auth = useAuth();
  const dashboard = useLiveData<{ nodes: LiveNode[] }>(auth.user ? "/v1/dashboard" : null, 60000);
  const [selected, setSelected] = useState("");
  const [metric, setMetric] = useState("dust_ug_m3");
  const nodes = dashboard.data?.nodes || [];
  const node = nodes.find(n => n.id === selected) || nodes.find(n => ["admin", "operator"].includes(n.role)) || nodes[0];
  const rules = useLiveData<{ rules: Rule[] }>(node ? `/v1/rules?node_id=${encodeURIComponent(node.id)}` : null, 60000);
  const [exportNotice, setExportNotice] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  const canManage = !!node && ["admin", "operator"].includes(node.role);
  const currentMetric = metric === "pm25_ug_m3" && !node?.pm25_validated ? "dust_ug_m3" : metric;
  const saved = rules.data?.rules.find(r => r.metric === currentMetric);
  return <section className="management-page">
    <header className="live-heading"><div><h1>Kelola kawasan</h1><p>Ambang peringatan dan kendali sprinkler pada lokasi Anda.</p></div><Settings2 size={27} aria-hidden="true" /></header>
    {auth.isLoading || (auth.user && dashboard.loading && !dashboard.data) ? <DataState loading /> : !auth.user ? <div className="management-access"><LockKeyhole size={28} /><h2>Masuk sebagai pengelola lokasi</h2><p>Tim industri dan kader governance dapat mengatur ambang setelah memperoleh penugasan lokasi dari admin.</p><Link className="live-button" to="/login">Masuk ke akun<ArrowUpRight size={16} /></Link></div> : dashboard.error ? <DataState error={dashboard.error} retry={dashboard.refresh} /> : !node ? <DataState empty="Belum ada perangkat pada lokasi akun Anda. Hubungi admin untuk penugasan lokasi." /> : <>
      <div className="management-location"><MapPin size={20} /><label>Perangkat pemantauan<MonitoringSelect label="Perangkat untuk pengelolaan" value={node.id} onValueChange={value => { setSelected(value); setMetric("dust_ug_m3"); setExportNotice(""); setSavedNotice(""); }} options={nodes.map(n => ({ value: n.id, label: n.name }))} /></label><span className="management-role"><LockKeyhole size={14} />{canManage ? "Akses pengelola lokasi" : "Akses lihat saja"}</span></div>
      <SprinklerControl key={node.id} nodeId={node.id} />
      <div className="management-layout">
        <section className="management-rules"><div className="management-section-heading"><div><h2>Aturan peringatan</h2><p>Pilih parameter untuk melihat atau memperbarui ambangnya.</p></div></div>
          {rules.error ? <DataState error={rules.error} retry={rules.refresh} /> : rules.loading && !rules.data ? <DataState loading /> : <>
            <div className="management-parameters" aria-label="Pilih parameter ambang">{Object.entries(metricLabels).filter(([key]) => key !== "pm25_ug_m3" || node.pm25_validated).map(([key, [label]]) => <button key={key} aria-pressed={currentMetric === key} onClick={() => { setMetric(key); setSavedNotice(""); }}>{label}{rules.data?.rules.some(r => r.metric === key && r.enabled) && <span className="rule-active-dot" aria-label="Aturan aktif" />}</button>)}</div>
            {canManage ? <ThresholdEditor key={`${node.id}:${currentMetric}:${saved?.high}:${saved?.danger_high}:${saved?.clear_below}:${saved?.enabled}:${saved?.cooldown_seconds}`} node={node} metric={currentMetric} rule={saved} onEdited={() => setSavedNotice("")} onSaved={() => { setSavedNotice("Ambang tersimpan. Aturan digunakan pada pembacaan berikutnya."); rules.refresh(); dashboard.refresh(); }} /> : <div className="management-readonly"><LockKeyhole size={21} /><p>Akun ini hanya dapat melihat aturan. Pengubahan ambang memerlukan penugasan pengelola oleh admin pada lokasi ini.</p>{saved ? <dl><div><dt>Waspada</dt><dd>{saved.high} {saved.unit}</dd></div><div><dt>Bahaya</dt><dd>{saved.danger_high ?? "Belum diatur"} {saved.danger_high != null && saved.unit}</dd></div><div><dt>Pulih di bawah</dt><dd>{saved.clear_below} {saved.unit}</dd></div></dl> : <p>Belum ada aturan untuk parameter ini.</p>}</div>}
            {savedNotice && <p className="threshold-success" role="status">{savedNotice}</p>}
          </>}
        </section>
        <aside className="management-side"><section><FileSpreadsheet size={25} /><h2>Data siap diolah</h2><p>Unduh konfigurasi ambang saat ini atau buka riwayat untuk mengekspor pembacaan ke CSV.</p><button className="live-button secondary" disabled={!canManage || !rules.data?.rules.length || rules.loading || !!rules.error} onClick={() => { downloadCsv(rulesCsv(node, rules.data?.rules || []), `aerosense-ambang-${node.id}.csv`); setExportNotice("CSV konfigurasi ambang diunduh."); }}>Unduh CSV ambang</button><Link className="management-history-link" to="/analytics">Buka riwayat & ekspor CSV<ArrowUpRight size={15} /></Link>{exportNotice && <p role="status">{exportNotice}</p>}</section><section className="management-context"><LockKeyhole size={21} /><h3>Akses mengikuti lokasi</h3><p>Admin menetapkan pengelola per lokasi. Ambang yang Anda simpan berlaku bersama untuk perangkat tersebut.</p><p>Ini adalah ambang operasional pengelola. Pemeriksaan baku mutu dan kepatuhan mengikuti metodologi tersendiri.</p></section></aside>
      </div>
    </>}
  </section>;
}

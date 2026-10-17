import { useState } from "react";
import { ArrowUpRight, ChevronDown, Flame, Waves, Activity, HeartHandshake, RefreshCw } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { dateLabel } from "@/types/live.types";

interface DisasterItem {
  id: string; title: string; url: string; source: string; original_title: string;
  type: string; location: string; kind: string; published_at: string; stale: boolean;
  event_started_at?: string | null;
  metrics: { value: number; unit: string; label: string }[];
}
interface DisasterResponse {
  items: DisasterItem[];
  sources: { name: string; last_success_at: string | null; error: string | null }[];
  help: { title: string; text: string; url: string }[];
}
export function DisasterNews({ compact = false }: { compact?: boolean }) {
  const { data, error, loading, refresh } = useLiveData<DisasterResponse>("/v1/disasters", 300000, false);
  const [filter, setFilter] = useState("Semua");
  const [expanded, setExpanded] = useState(false);
  const items = (data?.items || []).filter(i => filter === "Semua" || i.type === filter);
  const shown = items.slice(0, expanded ? 24 : compact ? 2 : 3);
  return <section className="disaster-section" id="kabar-bencana" aria-labelledby="disaster-heading">
    <header className="disaster-heading">
      <div><h2 id="disaster-heading">Kabar bencana Indonesia</h2><p>Pembaruan 7 hari terakhir</p></div>
      <button className="live-icon-button" aria-label="Perbarui kabar bencana" disabled={loading} onClick={refresh}><RefreshCw size={17} className={loading ? "refreshing" : ""} /></button>
    </header>
    {!compact && <div className="disaster-filters" role="group" aria-label="Filter kabar bencana">
      {["Semua", "Karhutla", "Banjir", "Gempa"].map(f => <button key={f} aria-pressed={filter === f} onClick={() => { setFilter(f); setExpanded(false); }}>{f}</button>)}
    </div>}
    {loading && !data ? <p className="disaster-empty" role="status">Memuat kabar terbaru…</p>
      : !data ? <div className="disaster-empty"><p>Kabar bencana belum tersedia.</p><button onClick={refresh}>Coba lagi</button></div>
      : <>
        {error && <p className="disaster-notice" role="status">Pembaruan tertunda. Periksa waktu sumber.</p>}
        {shown.length ? <div className={`disaster-grid ${compact ? "disaster-compact" : ""}`}>
          {shown.map(item => {
            const Icon = item.type === "Karhutla" ? Flame : item.type === "Banjir" ? Waves : Activity;
            const metric = item.metrics[0];
            return <article key={item.id} className={`disaster-card ${item.type === "Karhutla" ? "disaster-fire" : ""}`}>
              <div className="disaster-card-top"><span><Icon size={16} aria-hidden="true" />{item.type}</span><small>{item.location}</small></div>
              <h3><a href={item.url} target="_blank" rel="noreferrer" title={item.original_title}>{item.title}<ArrowUpRight size={17} /></a></h3>
              {item.event_started_at && <small className="disaster-note disaster-event-date">Mulai dipantau {new Date(item.event_started_at).toLocaleDateString("id-ID",{timeZone:"Asia/Jakarta",day:"numeric",month:"short",year:"numeric"})}</small>}
              {metric && <div className="disaster-metric"><strong>{metric.value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}<small>{metric.unit}</small></strong><span>{metric.label}</span></div>}
              <footer><a href={item.url} target="_blank" rel="noreferrer">{item.source}<ArrowUpRight size={12} /></a><time dateTime={item.published_at}>{dateLabel(item.published_at)}</time></footer>
              {(item.kind === "monitoring" || item.stale) && <small className="disaster-note">{item.stale ? "Pembaruan sumber tertunda. " : ""}{item.kind === "monitoring" ? "Pantauan model, belum konfirmasi lapangan." : ""}</small>}
            </article>;
          })}
        </div> : <p className="disaster-empty">Belum ada pembaruan {filter === "Semua" ? "bencana Indonesia" : filter.toLowerCase()} dalam feed yang dipantau.</p>}
        {items.length > shown.length && <button className="disaster-more" onClick={() => setExpanded(true)}>Lihat kabar lainnya <ChevronDown size={16} /></button>}
      </>}
    <div className="disaster-help"><HeartHandshake size={21} aria-hidden="true" /><strong>Ingin membantu?</strong>
      {(data?.help || [
        {title:"Bantu lewat PMI",url:"https://donasi.pmi.or.id/donation/monetary/donate-now"},
        {title:"Arahan BNPB",url:"https://www.bnpb.go.id/"}
      ]).map(h => <a href={h.url} key={h.url} target="_blank" rel="noreferrer">{h.title}<ArrowUpRight size={14} /></a>)}
    </div>
    <details className="insight-disclosure disaster-sources"><summary><span>Sumber & cara membantu</span><ChevronDown size={17} /></summary>
      <div className="insight-detail-body"><ul>
        <li>ANTARA: judul berita dengan lokasi Indonesia yang dapat dikenali. GDACS: notifikasi yang berkode negara IDN.</li>
        <li>Luas dari GDACS merupakan estimasi model. Angka antarperistiwa tidak dijumlahkan menjadi total nasional.</li>
        <li>Dukung lewat kanal resmi. Relawan perlu berkoordinasi dengan BNPB, BPBD atau PMI sebelum berangkat.</li>
      </ul><p>Daftar ini mengikuti ketersediaan feed dan tidak mencakup seluruh kejadian. Ikuti arahan petugas setempat.</p>
      {data?.sources.map((s,i) => <p key={i}>{s.name}: {s.error || dateLabel(s.last_success_at)}</p>)}
      </div>
    </details>
  </section>;
}

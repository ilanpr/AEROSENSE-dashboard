import { useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Flame,
  Waves,
  Activity,
  HeartHandshake,
  RefreshCw,
} from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { dateLabel } from "@/types/live.types";

interface DisasterItem {
  id: string;
  title: string;
  url: string;
  source: string;
  original_title: string;
  type: string;
  location: string;
  kind: string;
  published_at: string;
  stale: boolean;
  event_started_at?: string | null;
  metrics: { value: number; unit: string; label: string }[];
}
interface DisasterResponse {
  status?: string;
  items: DisasterItem[];
}
const filters = [
  { value: "Semua", label: "Semua" },
  { value: "Karhutla", label: "Kebakaran hutan & lahan" },
  { value: "Banjir", label: "Banjir" },
  { value: "Gempa", label: "Gempa" },
];

export function DisasterNews({ compact = false }: { compact?: boolean }) {
  const { data, error, loading, refresh } = useLiveData<DisasterResponse>(
    "/v1/disasters",
    300000,
    false,
  );
  const [filter, setFilter] = useState("Semua");
  const [expanded, setExpanded] = useState(false);
  const items = (data?.items || []).filter((i) => filter === "Semua" || i.type === filter);
  const shown = items.slice(0, expanded ? 24 : compact ? 2 : 3);
  return (
    <section className="disaster-section" id="kabar-bencana" aria-labelledby="disaster-heading">
      <header className="disaster-heading">
        <div>
          <h2 id="disaster-heading">Kabar bencana Indonesia</h2>
          <p>7 hari terakhir · Sumber publik</p>
        </div>
        <button
          className="live-icon-button"
          aria-label="Perbarui kabar bencana"
          disabled={loading}
          onClick={refresh}
        >
          <RefreshCw size={17} className={loading ? "refreshing" : ""} />
        </button>
      </header>
      <div className="disaster-toolbar">
        <div className="disaster-filters" role="group" aria-label="Jenis bencana">
          {filters.map(({ value, label }) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setExpanded(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {data && data.status !== "unavailable" && (
          <span className="disaster-result-count" role="status">{items.length} kabar</span>
        )}
      </div>
      {loading && !data ? (
        <p className="disaster-empty" role="status">
          Memuat kabar terbaru…
        </p>
      ) : !data ? (
        <div className="disaster-empty">
          <p>Kabar bencana belum tersedia.</p>
          <button onClick={refresh}>Coba lagi</button>
        </div>
      ) : (
        <>
          {error && (
            <p className="disaster-notice" role="status">
              Pembaruan tertunda. Periksa waktu sumber.
            </p>
          )}
          {shown.length ? (
            <div className={`disaster-grid ${compact ? "disaster-compact" : ""}`}>
              {shown.map((item) => {
                const Icon =
                  item.type === "Karhutla" ? Flame : item.type === "Banjir" ? Waves : Activity;
                const metric = item.metrics[0];
                return (
                  <article
                    key={item.id}
                    className={`disaster-card ${item.type === "Karhutla" ? "disaster-fire" : ""}`}
                  >
                    <div className="disaster-card-top">
                      <span>
                        <Icon size={16} aria-hidden="true" />
                        {filters.find(({ value }) => value === item.type)?.label ?? item.type}
                      </span>
                      <small>{item.location}</small>
                    </div>
                    <h3>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        title={item.original_title}
                      >
                        {item.title}
                        <ArrowUpRight size={17} />
                      </a>
                    </h3>
                    {item.event_started_at && (
                      <small className="disaster-note disaster-event-date">
                        Mulai dipantau{" "}
                        {new Date(item.event_started_at).toLocaleDateString("id-ID", {
                          timeZone: "Asia/Jakarta",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </small>
                    )}
                    {metric && (
                      <div className="disaster-metric">
                        <strong>
                          {metric.value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
                          <small>{metric.unit}</small>
                        </strong>
                        <span>{metric.label}</span>
                      </div>
                    )}
                    <footer>
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.source}
                        <ArrowUpRight size={12} />
                      </a>
                      <time dateTime={item.published_at}>{dateLabel(item.published_at)}</time>
                    </footer>
                    {(item.kind === "monitoring" || item.stale) && (
                      <small className="disaster-note">
                        {item.stale ? "Pembaruan sumber tertunda. " : ""}
                        {item.kind === "monitoring"
                          ? "Pantauan model, belum konfirmasi lapangan."
                          : ""}
                      </small>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="disaster-empty">
              {data.status === "unavailable"
                ? "Sumber berita belum berhasil diperbarui. Coba lagi nanti."
                : filter === "Semua"
                  ? "Belum ada kabar dari sumber yang dipantau."
                  : `Belum ada kabar ${filters.find(({ value }) => value === filter)?.label.toLowerCase()} dari sumber yang dipantau.`}
            </p>
          )}
          {items.length > shown.length && (
            <button className="disaster-more" onClick={() => setExpanded(true)}>
              Lihat kabar lainnya <ChevronDown size={16} />
            </button>
          )}
        </>
      )}
      <div className="disaster-help">
        <HeartHandshake size={21} aria-hidden="true" />
        <strong>Ingin membantu?</strong>
        <a
          href="https://donasi.pmi.or.id/donation/monetary/donate-now"
          target="_blank"
          rel="noreferrer"
        >
          Bantu lewat PMI <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

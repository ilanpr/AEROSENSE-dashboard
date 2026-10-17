import { Link, useSearchParams } from "react-router-dom";
import {
  CloudSun,
  Wind,
  Sprout,
  Flame,
  Waves,
  Activity,
  RefreshCw,
  ArrowUpRight,
  ArrowRight,
  MapPin,
  ShieldCheck,
  ChevronDown,
  Clock3,
} from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { useAuth } from "@/hooks/useAuth";
import { DataState } from "@/components/shared/DataState";
import { DisasterNews } from "@/components/environment/DisasterNews";
import { dateLabel, type EnvironmentResponse, type LiveNode } from "@/types/live.types";
import "@/styles/insights.css";
import {
  Atmosphere,
  ConditionScene,
} from "@/components/environment/ConditionScene";
import {
  conditionScene,
  environmentHighlights,
} from "@/lib/environment-presentation";

const categories = [
  { id: "weather", label: "Cuaca", icon: CloudSun },
  { id: "air_quality", label: "Udara", icon: Wind },
  { id: "soil", label: "Tanah", icon: Sprout },
  { id: "fire", label: "Titik panas", icon: Flame },
  { id: "flood", label: "Sungai", icon: Waves },
  { id: "earthquake", label: "Gempa", icon: Activity },
];
const periodLabel: Record<string, string> = {
  current: "Estimasi wilayah",
  forecast: "Prakiraan",
  monitoring: "Pantauan satelit 24 jam",
  reference: "Catatan sumber",
};

export function EnvironmentPage({ compact = false }: { compact?: boolean }) {
  const Heading = compact ? "h2" : "h1";
  const { user, isLoading: authLoading } = useAuth();
  const dashboard = useLiveData<{ nodes: LiveNode[] }>(
    user ? "/v1/dashboard" : null,
    60000,
  );
  const nodes = dashboard.data?.nodes || [];
  const [params, setParams] = useSearchParams();
  const node = nodes.find((n) => n.id === params.get("node_id")) || nodes[0];
  const { data, error, loading, refresh } = useLiveData<EnvironmentResponse>(
    node ? `/v1/environment?node_id=${encodeURIComponent(node.id)}` : null,
    60000,
  );
  const pageLoading = authLoading || dashboard.loading || (!!node && loading);
  const category = categories.some((c) => c.id === params.get("topic"))
    ? params.get("topic")!
    : "weather";
  const insights = data?.insights || [];
  const important =
    insights.find(
      (i) =>
        i.category === "air_quality" &&
        ["warning", "danger"].includes(i.tone) &&
        i.available,
    ) ||
    insights.find((i) => i.category === "weather" && i.available) ||
    insights.find((i) => i.available && i.period !== "reference") ||
    insights[0];
  const selected = compact
    ? important
    : insights.find((i) => i.category === category);
  const facts = data?.facts || data?.providers.flatMap((p) => p.facts) || [];
  const selectedFacts = facts.filter(
    (f) =>
      f.category === (selected?.category || category) ||
      ((selected?.category || category) === "soil" &&
        f.category === "soil_profile"),
  );
  const glances = insights
    .filter(
      (i) =>
        ["air_quality", "soil", "fire", "weather"].includes(i.category) &&
        i.category !== selected?.category,
    )
    .slice(0, 3);
  const highlights = selected ? environmentHighlights(selected, facts) : [];
  const scene = selected ? conditionScene(selected, facts) : "cloudy";
  const activeCategory = categories.find((c) => c.id === selected?.category);
  return (
    <section
      className={`environment-hub insights-hub ${compact ? "insights-compact" : ""}`}
    >
      <header className="insights-heading">
        <div>
          <Heading>
            {node ? `Lingkungan · ${node.name}` : "Lingkungan robot"}
          </Heading>
          <p>
            <MapPin size={15} aria-hidden="true" />
            {node
              ? `${node.latitude.toFixed(4)}, ${node.longitude.toFixed(4)} · mengikuti titik node`
              : "Pilih titik robot"}
          </p>
        </div>
        <div className="live-actions">
          {!compact && nodes.length > 0 && (
            <label className="sensor-select sensor-select--light">
              <MapPin size={15} aria-hidden="true" />
              <span className="sr-only">Pilih titik robot</span>
              <select
                aria-label="Pilih titik robot"
                value={node?.id || ""}
                onChange={(event) => {
                  const next = new URLSearchParams(params);
                  next.set("node_id", event.target.value);
                  setParams(next);
                }}
              >
                {nodes.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          )}
          {compact && (
            <Link className="insight-text-link" to="/environment">
              Jelajahi hub <ArrowUpRight size={16} />
            </Link>
          )}
          <button
            className="live-icon-button"
            onClick={refresh}
            disabled={loading}
            aria-label="Perbarui informasi lingkungan"
          >
            <RefreshCw size={17} className={loading ? "refreshing" : ""} />
          </button>
        </div>
      </header>
      {!compact && (
        <div
          className="insight-topics"
          role="group"
          aria-label="Jenis informasi lingkungan"
        >
          {categories.map((c) => (
            <button
              key={c.id}
              aria-pressed={category === c.id}
              onClick={() => setParams({ topic: c.id }, { replace: true })}
            >
              <c.icon size={17} />
              {c.label}
            </button>
          ))}
        </div>
      )}
      {pageLoading && !data ? (
        <DataState loading />
      ) : (dashboard.error || error) && !data ? (
        <DataState error={dashboard.error || error} retry={() => { dashboard.refresh(); refresh(); }} />
      ) : !nodes.length ? (
        <DataState empty="Belum ada titik robot yang bisa dipantau." />
      ) : !selected ? (
        <DataState empty="Ringkasan belum siap. Coba perbarui beberapa saat lagi." />
      ) : (
        <>
          {error && (
            <p className="live-notice" role="alert">
              Pembaruan belum berhasil. Periksa waktu data di bawah.
            </p>
          )}
          <article
            key={selected.category}
            className={`insight-lead panel-${scene} tone-${selected.tone}`}
          >
            <Atmosphere />
            <div className="insight-message">
              <span
                className={`insight-status ${selected.available ? "" : "status-pending"}`}
              >
                <span />
                {selected.available
                  ? periodLabel[selected.period]
                  : "Menunggu pembaruan"}
              </span>
              <h2>{selected.title}</h2>

              <div className="insight-action">
                <ArrowRight size={18} aria-hidden="true" />
                <strong>{selected.action}</strong>
              </div>
              {selected.valid_at && (
                <small className="insight-date">
                  <Clock3 size={13} aria-hidden="true" />
                  {selected.period === "reference"
                    ? "Catatan sumber"
                    : selected.period === "forecast"
                      ? "Berlaku pada"
                      : "Waktu data"}{" "}
                  {dateLabel(selected.valid_at)}
                </small>
              )}
            </div>
            <ConditionScene scene={scene} muted={!selected.available} />
            {highlights.length > 0 && (
              <dl className="panel-metrics">
                {highlights.map((h) => (
                  <div key={h.label}>
                    <dt>{h.label}</dt>
                    <dd>
                      {h.value}
                      <small>{h.unit}</small>
                    </dd>
                  </div>
                ))}
              </dl>
            )}

          </article>
          {compact && (
            <div className="insight-glances" aria-label="Sekilas lingkungan">
              {glances.map((i) => {
                const c = categories.find((c) => c.id === i.category)!;
                return (
                  <Link
                    key={i.category}
                    to={`/environment?topic=${i.category}`}
                    className={`insight-glance tone-${i.tone}`}
                  >
                    <div className="glance-heading">
                      <c.icon size={18} aria-hidden="true" />
                      <span>{c.label}</span>
                      <ArrowUpRight size={15} />
                    </div>
                    <ConditionScene
                      scene={conditionScene(i, facts)}
                      muted={!i.available}
                      small
                    />
                    <h3>{i.title}</h3>
                    {environmentHighlights(i, facts)
                      .slice(0, 1)
                      .map((h) => (
                        <div className="glance-number" key={h.label}>
                          <strong>{h.value}</strong>
                          <span>{h.unit}</span>
                        </div>
                      ))}
                    <small>
                      {i.available
                        ? periodLabel[i.period]
                        : "Belum ada pembaruan"}
                    </small>
                  </Link>
                );
              })}
            </div>
          )}
          {!compact && (
            <div className="insight-secondary">
              <Link
                className="live-button"
                to={`/aerobot?question=${encodeURIComponent(`Jelaskan kondisi ${activeCategory?.label.toLowerCase()} di sekitar titik ${node?.name || "robot"} dari informasi publik terbaru.`)}`}
              >
                Tanya AERO-BOT <ArrowUpRight size={16} />
              </Link>
              <a
                href="#rincian-lingkungan"
                className="insight-text-link"
                onClick={() => {
                  const details = document.getElementById(
                    "rincian-lingkungan",
                  ) as HTMLDetailsElement | null;
                  if (details) details.open = true;
                }}
              >
                Lihat rincian data <ChevronDown size={16} />
              </a>
            </div>
          )}
          {!compact && (
            <details id="rincian-lingkungan" className="insight-disclosure">
              <summary>
                <span>Rincian {activeCategory?.label.toLowerCase()}</span>
                <ChevronDown size={18} />
              </summary>
              <div className="insight-detail-body">
                <p>
                  Waktu dan sumber tiap pembacaan.
                </p>
                {!selectedFacts.length ? (
                  <p>Belum ada rincian untuk kategori ini.</p>
                ) : (
                  <dl className="insight-fact-list">
                    {selectedFacts.map((f) => (
                      <div key={f.id}>
                        <dt>
                          {f.label}
                          <small>
                            {f.stale
                              ? "Data lama"
                              : f.kind === "forecast"
                                ? "Prakiraan"
                                : [
                                      "historical",
                                      "static_model",
                                      "event",
                                    ].includes(f.kind)
                                  ? "Catatan sumber"
                                  : "Estimasi terbaru"}
                          </small>
                        </dt>
                        <dd>
                          <strong>
                            {typeof f.value === "number"
                              ? f.value.toLocaleString("id-ID", {
                                  maximumFractionDigits: 2,
                                })
                              : f.value}{" "}
                            <small>{f.unit}</small>
                          </strong>
                          <span>{dateLabel(f.valid_at)}</span>
                          <a
                            href={
                              /^https:\/\//.test(f.source_url)
                                ? f.source_url
                                : undefined
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            {f.source}
                            <ArrowUpRight size={12} />
                          </a>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </details>
          )}
          <details className="insight-disclosure credibility-section">
            <summary>
              <span>
                <ShieldCheck size={18} />
                Sumber & catatan
              </span>
              <ChevronDown size={18} />
            </summary>
            <div className="insight-detail-body">
              <p>Data publik mengikuti koordinat node yang dipilih. Sumber dan waktu pembaruan tercantum di tiap data. Kategori udara memakai US AQI, bukan ISPU.</p>
              <ul className="insight-source-list">
                {data?.providers.map((p) => {
                  const f = p.facts[0];
                  return (
                    <li key={p.provider}>
                      <div>
                        {f && /^https:\/\//.test(f.source_url) ? (
                          <a
                            href={f.source_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {f.source}
                            <ArrowUpRight size={13} />
                          </a>
                        ) : (
                          <strong>{p.provider.replace(/_/g, " ")}</strong>
                        )}
                        <small>
                          {p.last_error ||
                            (p.facts.length
                              ? "Terhubung ke sumber"
                              : "Belum ada data yang sesuai")}
                        </small>
                      </div>
                      <span>
                        Terakhir dicoba {dateLabel(p.last_attempt_at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p>
                Titik panas belum memastikan kebakaran. Debit sungai bukan peringatan banjir. Cakupan titik panas 50 km dan gempa 300 km dari titik node.
              </p>
              <p>
                Lokasi acuan: {data?.area.latitude}, {data?.area.longitude}.
                Data dan atribusi tersedia pada tautan sumber di atas.{" "}
                <a
                  href="https://www.airnow.gov/aqi/aqi-basics/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Tentang kategori US AQI
                </a>
                .
              </p>
            </div>
          </details>
        </>
      )}
      <DisasterNews compact={compact} />
    </section>
  );
}

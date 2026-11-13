import { useState } from "react";
import { MonitoringSelect } from "@/components/shared/MonitoringSelect";
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
import { WeatherOutlook } from "@/components/weather/WeatherOutlook";
import { useAuth } from "@/hooks/useAuth";
import { DataState } from "@/components/shared/DataState";
import { DisasterNews } from "@/components/environment/DisasterNews";
import { SoilHistory } from "@/components/environment/SoilHistory";
import { dateLabel, type EnvironmentResponse, type LiveNode } from "@/types/live.types";
import "@/styles/insights.css";
import { Atmosphere, ConditionScene } from "@/components/environment/ConditionScene";
import { conditionScene, environmentHighlights, riverDayLabel } from "@/lib/environment-presentation";
import { distanceKm, distanceLabel, validPoint, type GeoPoint } from "@/lib/nearby-nodes";

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
    `/v1/dashboard?account=${encodeURIComponent(user?.id || "guest")}`,
    60000,
  );
  const nodes = dashboard.data?.nodes || [];
  const [params, setParams] = useSearchParams();
  const [locationMode, setLocationMode] = useState<"node" | "device">("node");
  const [userPoint, setUserPoint] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const selectedNode = nodes.find((n) => n.id === params.get("node_id")) || nodes[0];
  const nearest =
    userPoint && nodes.length
      ? nodes
          .filter(validPoint)
          .map((candidate) => ({
            node: candidate,
            distance: distanceKm(userPoint, candidate),
          }))
          .sort((a, b) => a.distance - b.distance)[0]
      : null;
  const node = locationMode === "device" && nearest ? nearest.node : selectedNode;
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
      (i) => i.category === "air_quality" && ["warning", "danger"].includes(i.tone) && i.available,
    ) ||
    insights.find((i) => i.category === "weather" && i.available) ||
    insights.find((i) => i.available && i.period !== "reference") ||
    insights[0];
  const selected = compact ? important : insights.find((i) => i.category === category);
  const facts = data?.facts || data?.providers.flatMap((p) => p.facts) || [];
  const selectedFacts = facts.filter(
    (f) =>
      f.category === (selected?.category || category) ||
      ((selected?.category || category) === "soil" && f.category === "soil_profile"),
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
  function updateParams(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => next.set(key, value));
    setParams(next, { replace: true });
  }
  function useDeviceLocation() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Peramban ini belum mendukung lokasi perangkat.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        const point = {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
        };
        setLocating(false);
        if (!validPoint(point)) {
          setLocationError("Koordinat belum terbaca. Coba lagi.");
          return;
        }
        setUserPoint(point);
        setLocationMode("device");
        const closest = nodes
          .filter(validPoint)
          .map((candidate) => ({ candidate, distance: distanceKm(point, candidate) }))
          .sort((a, b) => a.distance - b.distance)[0];
        if (closest) updateParams({ node_id: closest.candidate.id });
      },
      (locationFailure) => {
        setLocating(false);
        setLocationError(
          locationFailure.code === 1
            ? "Izin lokasi ditolak. Izinkan lokasi melalui pengaturan situs, lalu coba lagi."
            : locationFailure.code === 3
              ? "Lokasi belum ditemukan. Coba di area dengan sinyal lebih baik."
              : "Lokasi perangkat belum tersedia. Periksa layanan lokasi lalu coba lagi.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }
  return (
    <section className={`environment-hub insights-hub ${compact ? "insights-compact" : ""}`} data-topic={category}>
      <header className="insights-heading">
        <div>
          <Heading>
            {locationMode === "device" && userPoint ? (
              <>
                Lingkungan <span className="heading-accent">di sekitar Anda</span>
              </>
            ) : node ? (
              <>
                Lingkungan di <span className="heading-accent">{node.name}</span>
              </>
            ) : (
              <>
                Lingkungan <span className="heading-accent">sekitar</span>
              </>
            )}
          </Heading>
          <p>
            <MapPin size={15} aria-hidden="true" />
            {locationMode === "device" && userPoint && node
              ? `${userPoint.latitude.toFixed(4)}, ${userPoint.longitude.toFixed(4)} · node acuan ${node.name}${nearest ? ` (${distanceLabel(nearest.distance)})` : ""}`
              : node
                ? `${node.latitude.toFixed(4)}, ${node.longitude.toFixed(4)}`
                : "Pilih titik sensor"}
          </p>
          {locationError && (
            <p className="environment-location-error" role="alert">
              {locationError}
            </p>
          )}
        </div>
        <div className="live-actions">
          {!compact && nodes.length > 0 && (
            <label className="sensor-select sensor-select--light">
              <MapPin size={15} aria-hidden="true" />
              <span className="sr-only">Acuan lokasi</span>
              <MonitoringSelect
                label="Acuan lokasi"
                value={locationMode === "device" ? "__device__" : node?.id || ""}
                disabled={locating}
                options={[
                  ...nodes.map((n) => ({ value: n.id, label: n.name })),
                  { value: "__device__", label: "Lokasi saya" },
                ]}
                onValueChange={(value) => {
                  if (value === "__device__") {
                    useDeviceLocation();
                    return;
                  }
                  setLocationMode("node");
                  setLocationError("");
                  updateParams({ node_id: value });
                }}
              />
            </label>
          )}
          {locating && <span className="sr-only" role="status">Mencari lokasi…</span>}
          {compact && (
            <Link className="insight-text-link" to="/environment">
              Buka Hub Lingkungan <ArrowUpRight size={16} />
            </Link>
          )}
          <button
            className="live-icon-button"
            onClick={() => {
              if (locationMode === "device") useDeviceLocation();
              refresh();
            }}
            disabled={loading || locating}
            aria-label="Perbarui informasi lingkungan"
          >
            <RefreshCw size={17} className={loading ? "refreshing" : ""} />
          </button>
        </div>
      </header>
      {!compact && (
        <div className="insight-topics" role="group" aria-label="Jenis informasi lingkungan">
          {categories.map((c) => (
            <button
              key={c.id}
              data-topic={c.id}
              aria-pressed={category === c.id}
              onClick={() => updateParams({ topic: c.id })}
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
        <DataState
          error={dashboard.error || error}
          retry={() => {
            dashboard.refresh();
            refresh();
          }}
        />
      ) : !nodes.length ? (
        <div>
          <DataState
            empty={
              user
                ? "Belum ada titik sensor untuk akun ini."
                : "Belum ada titik sensor publik."
            }
          />
          {!user && (
            <Link className="insight-text-link" to="/login">
              Masuk untuk melihat node akun <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
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
              <span className={`insight-status ${selected.available ? "" : "status-pending"}`}>
                <span />
                {selected.available ? periodLabel[selected.period] : "Menunggu pembaruan"}
              </span>
              <h2>{selected.title}</h2>
              {selected.category !== "weather" && <p>{selected.body}</p>}
              <div className="insight-action">
                <ArrowRight size={18} aria-hidden="true" />
                <strong>{selected.action}</strong>
              </div>
              {selected.valid_at && (
                <small className="insight-date">
                  <Clock3 size={13} aria-hidden="true" />
                  {selected.category === "flood" && selected.period === "forecast"
                    ? "Prakiraan harian"
                    : selected.period === "reference"
                    ? "Catatan sumber"
                    : selected.period === "forecast"
                      ? "Berlaku pada"
                      : "Waktu data"}{" "}
                  {selected.category === "flood" && selected.period === "forecast"
                    ? `${riverDayLabel(selected.valid_at)} UTC`
                    : dateLabel(selected.valid_at)}
                </small>
              )}
            </div>
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
            <ConditionScene scene={scene} muted={!selected.available} />
          </article>
          {!compact && selected.category === "soil" && (
            <SoilHistory
              history={selectedFacts.find((f) => selected.fact_ids.includes(f.id))?.soil_history}
            />
          )}
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
                    <ConditionScene scene={conditionScene(i, facts)} muted={!i.available} small />
                    <h3>{i.title}</h3>
                    {environmentHighlights(i, facts)
                      .slice(0, 1)
                      .map((h) => (
                        <div className="glance-number" key={h.label}>
                          <strong>{h.value}</strong>
                          <span>{h.unit}</span>
                        </div>
                      ))}
                    <small>{i.available ? periodLabel[i.period] : "Belum ada pembaruan"}</small>
                  </Link>
                );
              })}
            </div>
          )}
          {!compact && (
            <div className="insight-secondary">
              {node && ["fire", "earthquake"].includes(category) && (
                <Link
                  className="insight-text-link"
                  to={`/sensor-map?layer=events&event_type=${category}&node_id=${encodeURIComponent(node.id)}`}
                >
                  <MapPin size={16} />
                  {data?.event_layers?.some((layer) => layer.category === category && layer.event_count > 0)
                    ? "Lihat lokasi di peta"
                    : "Lihat cakupan di peta"}
                  <ArrowUpRight size={15} />
                </Link>
              )}
              <Link
                className="live-button"
                to={`/aerobot?question=${encodeURIComponent(`Jelaskan kondisi ${activeCategory?.label.toLowerCase()} ${locationMode === "device" ? `di sekitar lokasi saya dengan node acuan ${node?.name || "terdekat"}` : `di sekitar titik ${node?.name || "robot"}`} dari informasi publik terbaru.`)}`}
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
                                : ["historical", "static_model", "event"].includes(f.kind)
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
                            href={/^https:\/\//.test(f.source_url) ? f.source_url : undefined}
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
              <p>
                Data wilayah mengikuti titik sensor. Jika memakai lokasi perangkat, browser memilih
                sensor terdekat tanpa menyimpan koordinat atau mengirimkannya ke server.
              </p>
              <p>
                Estimasi ISPU PM2.5 memakai rata-rata 24 jam dari model Open-Meteo / CAMS dan
                rumus{" "}
                <a
                  href="https://peraturan.bpk.go.id/Details/163466/permen-lhk-no-14-tahun-2020"
                  target="_blank"
                  rel="noreferrer"
                >
                  Permen LHK No. 14 Tahun 2020
                </a>
                . Nilai ini hanya mencakup partikel halus PM2.5. US AQI memakai standar Amerika
                Serikat dan ditampilkan sebagai pembanding.
              </p>
              <p>
                Jadwal sumber: cuaca dan titik panas tiap jam, udara tiap 3 jam, debit sungai harian.
              </p>
              <ul className="insight-source-list">
                {data?.providers.map((p) => {
                  const f = p.facts[0];
                  return (
                    <li key={p.provider}>
                      <div>
                        {f && /^https:\/\//.test(f.source_url) ? (
                          <a href={f.source_url} target="_blank" rel="noreferrer">
                            {f.source}
                            <ArrowUpRight size={13} />
                          </a>
                        ) : (
                          <strong>{p.provider.replace(/_/g, " ")}</strong>
                        )}
                        <small>
                          {p.last_error ||
                            (p.facts.length ? "Terhubung ke sumber" : "Belum ada data yang sesuai")}
                        </small>
                        <small>
                          {p.facts.some((f) => f.stale)
                            ? "Sebagian data melewati masa berlaku"
                            : p.facts.length
                              ? "Data masih dalam masa berlaku sumber"
                              : "Belum ada fakta yang tersedia"}
                        </small>
                      </div>
                      <span>
                        Terakhir dicoba {dateLabel(p.last_attempt_at)}
                        <small>Jadwal berikutnya {dateLabel(p.refresh_after)}</small>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p>
                Titik panas belum memastikan kebakaran. Debit sungai bukan peringatan banjir.
                Cakupan titik panas 50 km dan gempa 300 km dari titik node.
              </p>
              <p>
                Lokasi acuan data: {data?.area.latitude}, {data?.area.longitude}
                {locationMode === "device" && nearest
                  ? ` · ${nearest.node.name}, ${distanceLabel(nearest.distance)} dari lokasi perangkat`
                  : ""}
                .{" "}
                <a href="https://www.airnow.gov/aqi/aqi-basics/" target="_blank" rel="noreferrer">
                  Tentang kategori US AQI
                </a>
                .
              </p>
            </div>
          </details>
        </>
      )}
      <WeatherOutlook
        compact={compact}
        place={locationMode === "device" && userPoint ? "lokasi Anda" : node?.name}
        point={locationMode === "device" && userPoint ? userPoint : node && validPoint(node) ? node : undefined}
      />
      <DisasterNews compact={compact} />
    </section>
  );
}

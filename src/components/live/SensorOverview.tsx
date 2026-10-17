import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ChevronDown,
  MapPin,
  RefreshCw,
  Radio,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLiveData } from "@/hooks/useLiveData";
import { DataState } from "@/components/shared/DataState";
import {
  Atmosphere,
  ConditionScene,
} from "@/components/environment/ConditionScene";
import { sensorSummary, type SensorRule } from "@/lib/environment-presentation";
import { dateLabel, metricLabels, type LiveNode } from "@/types/live.types";
import "@/styles/insights.css";

export function SensorOverview() {
  const { user, isLoading } = useAuth();
  const dashboard = useLiveData<{ nodes: LiveNode[] }>(
    user ? `/v1/dashboard?account=${encodeURIComponent(user.id)}` : null,
  );
  const [selected, setSelected] = useState("");
  const nodes = dashboard.data?.nodes || [];
  const node = nodes.find((n) => n.id === selected) || nodes[0];
  const rules = useLiveData<{ rules: SensorRule[] }>(
    node ? `/v1/rules?node_id=${encodeURIComponent(node.id)}` : null,
    60000,
  );
  const summary = sensorSummary(node, rules.data?.rules);
  const fresh = !!node?.latest?.reading_id && !node.latest.stale;
  const keys = [
    node?.pm25_validated ? "pm25_ug_m3" : "dust_ug_m3",
    "eco2_ppm",
    "temperature_c",
  ];
  return (
    <section className="insights-hub sensor-overview">
      <header className="insights-heading">
        <div>
          <span className="section-eyebrow">AEROSENSE DI LOKASI ANDA</span>
          <h1>Udara di dekat Anda.</h1>
          <p>Pembacaan node Anda menjadi acuan utama.</p>
        </div>
        <button
          className="live-icon-button"
          onClick={() => {
            dashboard.refresh();
            rules.refresh();
          }}
          aria-label="Perbarui pembacaan node"
        >
          <RefreshCw
            size={17}
            className={dashboard.loading ? "refreshing" : ""}
          />
        </button>
      </header>
      {isLoading || (dashboard.loading && !dashboard.data) ? (
        <DataState loading />
      ) : dashboard.error ? (
        <DataState error={dashboard.error} retry={dashboard.refresh} />
      ) : (
        <>
          <article className={`sensor-hero tone-${summary.tone}`}>
            <Atmosphere />
            <div className="sensor-hero-copy">
              <span
                className={`insight-status ${fresh ? "" : "status-pending"}`}
              >
                <span />
                {fresh ? "Pembacaan node terbaru" : "Belum ada data terbaru"}
              </span>
              <h2>{summary.title}</h2>
              <p>
                {!user
                  ? "Masuk untuk melihat pembacaan perangkat yang terhubung ke akun Anda."
                  : !nodes.length
                    ? "Belum ada node yang terhubung ke akun Anda. Hubungi pengelola untuk menambahkan akses lokasi."
                    : summary.body}
              </p>
              {nodes.length > 0 && (
                <label className="sensor-select">
                  <MapPin size={15} aria-hidden="true" />
                  <span className="sr-only">Pilih node AEROSENSE</span>
                  <select
                    aria-label="Pilih node AEROSENSE"
                    value={node?.id || ""}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Link
                className="panel-link"
                to={
                  user
                    ? node
                      ? `/nodes/${encodeURIComponent(node.id)}`
                      : "/nodes"
                    : "/login"
                }
              >
                {user ? "Lihat detail sensor" : "Masuk ke akun"}
                <ArrowUpRight size={16} />
              </Link>
            </div>
            <ConditionScene scene="sensor" muted={!fresh} />
            <dl className="panel-metrics sensor-key-metrics">
              {keys.map((key) => {
                const value = fresh ? node?.latest?.metrics[key] : null;
                return (
                  <div key={key}>
                    <dt>{metricLabels[key][0]}</dt>
                    <dd>
                      {typeof value === "number" && Number.isFinite(value)
                        ? value.toLocaleString("id-ID", {
                            maximumFractionDigits: 1,
                          })
                        : "—"}
                      <small>{metricLabels[key][1]}</small>
                    </dd>
                    {key === "dust_ug_m3" && (
                      <span>Sinyal debu, bukan PM2.5 tervalidasi</span>
                    )}
                    {key === "eco2_ppm" && (
                      <span>Estimasi sensor, bukan CO₂ langsung</span>
                    )}
                  </div>
                );
              })}
            </dl>
            <footer className="sensor-panel-footer">
              <span>
                <Radio size={13} />
                {fresh
                  ? dateLabel(node?.latest?.observed_at)
                  : "Nilai menunggu pembacaan baru"}
              </span>
              {node && (
                <span>
                  Titik node: {node.latitude.toFixed(4)},{" "}
                  {node.longitude.toFixed(4)}
                </span>
              )}
            </footer>
          </article>
          {nodes.length > 1 && (
            <div className="node-strip" aria-label="Status perangkat">
              {nodes.map((n) => (
                <button
                  key={n.id}
                  aria-pressed={n.id === node?.id}
                  onClick={() => setSelected(n.id)}
                >
                  <span
                    className={
                      n.latest?.reading_id && !n.latest.stale
                        ? "node-dot"
                        : "node-dot node-dot-pending"
                    }
                  />
                  <strong>{n.name}</strong>
                  <small>
                    {n.latest?.reading_id && !n.latest.stale
                      ? "Data terbaru"
                      : "Menunggu data"}
                  </small>
                </button>
              ))}
            </div>
          )}
          {node?.latest?.reading_id && node.latest.stale && (
            <details className="insight-disclosure">
              <summary>
                <span>Pembacaan terakhir sudah lama</span>
                <ChevronDown size={17} />
              </summary>
              <div className="insight-detail-body">
                <p>
                  Terakhir diterima {dateLabel(node.latest.observed_at)}. Nilai
                  lama tidak digunakan sebagai kondisi sekarang.
                </p>
                <Link to={`/nodes/${encodeURIComponent(node.id)}`}>
                  Buka riwayat node
                </Link>
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}

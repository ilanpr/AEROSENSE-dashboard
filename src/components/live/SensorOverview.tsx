import { MonitoringSelect } from "@/components/shared/MonitoringSelect";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
    `/v1/dashboard?account=${encodeURIComponent(user?.id || "guest")}`,
  );
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState("");
  const nodes = dashboard.data?.nodes || [];
  const node = nodes.find((n) => n.id === params.get("node_id")) || nodes.find((n) => n.id === selected) || nodes[0];
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
          <h1>Sensor AEROSENSE</h1>
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
                {fresh ? "Sensor terhubung" : "Menunggu data"}
              </span>
              <h2>{summary.title}</h2>
              <p>
                {!nodes.length ? "Belum ada node publik yang tersedia." : summary.body}
              </p>
              {nodes.length > 0 && (
                <label className="sensor-select">
                  <MapPin size={15} aria-hidden="true" />
                  <span className="sr-only">Pilih node AEROSENSE</span>
                  <MonitoringSelect label="Pilih node AEROSENSE" value={node?.id || ""}
                    options={nodes.map(n => ({value:n.id,label:n.name}))}
                    onValueChange={(value) => {
                      setSelected(value);
                      const next = new URLSearchParams(params); next.set("node_id", value); setParams(next);
                    }} />
                </label>
              )}
              <Link
                className="panel-link"
                to={
                  node ? `/nodes/${encodeURIComponent(node.id)}` : "/nodes"
                }
              >
                Lihat detail sensor
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
                    {key === "eco2_ppm" && (
                      <span>Estimasi eCO₂</span>
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
                  : "Belum ada pembacaan"}
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
                  onClick={() => {
                    setSelected(n.id);
                    const next = new URLSearchParams(params);
                    next.set("node_id", n.id);
                    setParams(next);
                  }}
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

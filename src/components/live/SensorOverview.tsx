import { NodeStatus } from "./NodeStatus";
import { AeroMascot } from "@/components/environment/AeroMascot";
import { MonitoringSelect } from "@/components/shared/MonitoringSelect";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  MapPin,
  RefreshCw,
  Radio,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLiveData } from "@/hooks/useLiveData";
import { DataState } from "@/components/shared/DataState";
import { ConditionScene } from "@/components/environment/ConditionScene";
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
  const summary = sensorSummary(node, rules.data?.rules || node?.rules);
  const pose = summary.tone === "danger" ? "alert" : summary.tone === "warning" || summary.tone === "pending" ? "watch" : "calm";
  const recommendation = summary.tone === "danger" ? "Minta pengelola memeriksa lokasi dan sensor."
    : summary.tone === "warning" ? "Cek titik terdekat dan perubahan di lokasi."
    : summary.tone === "pending" ? "Periksa koneksi node dan tunggu pembacaan baru."
    : "Pantau lagi jika kondisi sekitar berubah.";
  const heroTitle = summary.tone === "calm" ? "Udara terpantau baik." : summary.title;
  const titleParts = heroTitle.trim().split(/\s+/);
  const titleAccent = titleParts.pop();
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
          <h1>Kondisi udara <span className="heading-accent">di titik AEROSENSE.</span></h1>
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
          <div className="sensor-focus-grid">
          <article className={`sensor-hero tone-${summary.tone}`}>
            <div className="sensor-hero-copy">
              <span
                className={`insight-status ${fresh ? "" : "status-pending"}`}
              >
                <span />
                {summary.tone === "calm" ? "Estimasi sensor terbaru" : summary.label}
              </span>
              <h2 className="sensor-status-title">
                {titleParts.join(" ")}{titleParts.length > 0 && " "}
                <span>{titleAccent}</span>
              </h2>
              <p className="sensor-recommendation"><ArrowRight size={17} aria-hidden="true" />
                <span>{!nodes.length ? "Belum ada node publik yang tersedia." : recommendation}</span>
              </p>
              <div className="sensor-node-controls">
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
            </div>
            <ConditionScene scene="sensor" muted={!fresh} />
            <dl className="panel-metrics sensor-key-metrics">
              {keys.map((key) => {
                const value = fresh ? node?.latest?.metrics[key] : null;
                return (
                  <div key={key} style={{ backdropFilter: "var(--metric-backdrop)" }}>
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
          <aside className={`aero-assist assist-${summary.tone}`}>
            <span className="assist-orbit assist-orbit-one" aria-hidden="true" />
            <span className="assist-orbit assist-orbit-two" aria-hidden="true" />
            <div className="assist-copy">
              <h2>{summary.tone === "danger" ? "Periksa titik ini sekarang." : summary.tone === "warning" ? "Ada yang perlu dicek." : summary.tone === "pending" ? "Tunggu data terbaru." : "Kenali kondisi sekitar."}</h2>
              <p>{summary.tone === "danger" ? "Cek lokasi dan perangkat sebelum menentukan tindakan." : summary.tone === "warning" ? "Bandingkan dengan titik terdekat dan periksa sumber perubahan." : summary.tone === "pending" ? "Status baru muncul setelah pembacaan dan aturan tersedia." : "Lihat titik terdekat sebelum beraktivitas di luar."}</p>
              <Link to="/aerobot" className="assist-link">Tanya AERO-BOT <ArrowUpRight size={15} /></Link>
            </div>
            <div className="assist-visual">
              <svg className="assist-airflow" viewBox="0 0 360 340" fill="none" aria-hidden="true">
                <ellipse cx="180" cy="230" rx="154" ry="54" transform="rotate(-20 180 230)" />
                <path d="M28 160C74 116 123 122 165 145C213 171 283 172 330 120" />
                <path d="M44 271C102 301 232 303 312 245" />
              </svg>
              {Array.from({ length: 7 }, (_, index) => (
                <span key={index} className={`assist-particle particle-${index + 1}`} aria-hidden="true" />
              ))}
              <AeroMascot pose={pose} />
            </div>
          </aside>
          </div>
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
                  <span className={`node-dot dot-${sensorSummary(n).tone}`} />
                  <strong>{n.name}</strong>
                  <NodeStatus node={n} />
                </button>
              ))}
            </div>
          )}
          <details className="insight-disclosure status-method">
            <summary><span>Arti status sensor</span><ChevronDown size={17} /></summary>
            <div className="insight-detail-body">
              <p>Terpantau baik: pembacaan parameter udara berada di bawah ambang yang diatur. Waspada: ambang peringatan terlewati atau belum pulih. Bahaya: ambang bahaya yang diatur terlewati. Data lama, nilai tidak valid, atau aturan belum tersedia tidak diberi status bersih.</p>
              <p>Status ini untuk pemantauan sensor, bukan AQI, ISPU, kategori kesehatan, atau bukti sumber emisi. Debu optik dan eCO₂ tetap merupakan indikator sensor.</p>
              {node?.rules?.map(r=><p key={r.metric}>{metricLabels[r.metric]?.[0] || r.metric}: waspada ≥ {r.high} {r.unit}{r.danger_high != null ? ` · bahaya ≥ ${r.danger_high} ${r.unit}` : " · ambang bahaya belum diatur"}.</p>)}
            </div>
          </details>
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

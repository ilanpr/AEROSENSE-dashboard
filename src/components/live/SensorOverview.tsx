import { NodeStatus } from "./NodeStatus";
import { AeroMascot } from "@/components/environment/AeroMascot";
import { MonitoringSelect } from "@/components/shared/MonitoringSelect";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, ArrowRight, ChevronDown, MapPin, RefreshCw, Radio } from "lucide-react";
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
  const node =
    nodes.find((n) => n.id === params.get("node_id")) ||
    nodes.find((n) => n.id === selected) ||
    nodes[0];
  const rules = useLiveData<{ rules: SensorRule[] }>(
    node ? `/v1/rules?node_id=${encodeURIComponent(node.id)}` : null,
    60000,
  );
  const summary = sensorSummary(node, rules.data?.rules || node?.rules);
  const reading = node?.latest;
  const hasReading = !!reading?.reading_id;
  const stale = hasReading && reading.stale;
  const invalid = hasReading && reading.quality?.invalid === true;
  const fresh = hasReading && !stale && !invalid;
  const lastReadingTime = reading?.observed_at || reading?.received_at;
  const hubUrl = node ? `/environment?node_id=${encodeURIComponent(node.id)}` : "/environment";
  const pose =
    summary.tone === "danger"
      ? "alert"
      : summary.tone === "warning" || summary.tone === "pending"
        ? "watch"
        : "calm";
  const recommendation =
    summary.tone === "danger"
      ? "Minta pengelola memeriksa lokasi dan sensor."
      : summary.tone === "warning"
        ? "Cek titik terdekat dan perubahan di lokasi."
        : stale || invalid
          ? "Kondisi terkini di titik ini belum diketahui."
          : !hasReading
            ? "Pembacaan pertama akan muncul saat node mulai mengirim data."
            : summary.tone === "pending"
              ? "Status belum dapat dinilai dari pembacaan ini."
              : "Pantau lagi jika kondisi sekitar berubah.";
  const heroTitle = !node
    ? "Node belum tersedia."
    : !hasReading
      ? "Belum ada pembacaan."
      : stale
        ? "Data sensor sudah lama."
        : invalid
          ? "Pembacaan tidak valid."
          : summary.tone === "calm"
            ? "Pembacaan dalam batas."
            : summary.title;
  const titleParts = heroTitle.trim().split(/\s+/);
  const titleAccent = titleParts.pop();
  // Hero focuses on dust, temperature and humidity. Validated PM2.5 is shown only when the node is validated AND
  // actually reports it; otherwise the optical dust value is shown, labelled as an estimate from an uncalibrated sensor.
  const pm25 = reading?.metrics.pm25_ug_m3;
  const showPm25 = node?.pm25_validated === true && typeof pm25 === "number" && Number.isFinite(pm25);
  const keys = [showPm25 ? "pm25_ug_m3" : "dust_ug_m3", "temperature_c", "humidity_pct"];
  const heroLabels: Record<string, string> = { dust_ug_m3: "Debu (estimasi PM2.5)" };
  return (
    <section className="insights-hub sensor-overview">
      <header className="insights-heading">
        <div>
          <h1>
            Kondisi udara <span className="heading-accent">di titik AEROSENSE.</span>
          </h1>
        </div>
        <button
          className="live-icon-button"
          onClick={() => {
            dashboard.refresh();
            rules.refresh();
          }}
          aria-label="Perbarui pembacaan node"
        >
          <RefreshCw size={17} className={dashboard.loading ? "refreshing" : ""} />
        </button>
      </header>
      {isLoading || (dashboard.loading && !dashboard.data) ? (
        <DataState loading />
      ) : dashboard.error ? (
        <DataState error={dashboard.error} retry={dashboard.refresh} />
      ) : (
        <>
          <div className={`sensor-focus-grid${fresh ? "" : " sensor-focus-grid--unavailable"}`}>
            <article className={`sensor-hero tone-${summary.tone}${fresh ? "" : " sensor-hero--unavailable"}`}>
              <div className="sensor-hero-copy">
                <span className={`insight-status ${fresh ? "" : "status-pending"}`}>
                  <span />
                  {summary.tone === "calm" ? "Estimasi sensor terbaru" : summary.label}
                </span>
                <h2 className="sensor-status-title">
                  {titleParts.join(" ")}
                  {titleParts.length > 0 && " "}
                  <span>{titleAccent}</span>
                </h2>
                <p className="sensor-recommendation">
                  <ArrowRight size={17} aria-hidden="true" />
                  <span>
                    {!node ? "Lihat estimasi wilayah di Hub Lingkungan." : recommendation}
                  </span>
                </p>
                {hasReading && !fresh && (
                  <div className="sensor-reading-time">
                    Pembacaan terakhir · <time dateTime={lastReadingTime || undefined}>
                      {dateLabel(lastReadingTime)}
                    </time>
                  </div>
                )}
                <div className="sensor-node-controls">
                  {nodes.length > 0 && (
                    <label className="sensor-select">
                      <MapPin size={15} aria-hidden="true" />
                      <span className="sr-only">Pilih node AEROSENSE</span>
                      <MonitoringSelect
                        label="Pilih node AEROSENSE"
                        value={node?.id || ""}
                        options={nodes.map((n) => ({ value: n.id, label: n.name }))}
                        onValueChange={(value) => {
                          setSelected(value);
                          const next = new URLSearchParams(params);
                          next.set("node_id", value);
                          setParams(next);
                        }}
                      />
                    </label>
                  )}
                  <Link
                    className="panel-link"
                    to={fresh && node ? `/nodes/${encodeURIComponent(node.id)}` : hubUrl}
                  >
                    {fresh ? "Lihat detail sensor" : "Buka Hub Lingkungan"}
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              </div>
              {fresh && (
                <dl className="panel-metrics sensor-key-metrics">
                  {keys.map((key) => {
                    const value = reading?.metrics[key];
                    return (
                      <div key={key} style={{ backdropFilter: "var(--metric-backdrop)" }}>
                        <dt>{heroLabels[key] ?? metricLabels[key][0]}</dt>
                        <dd>
                          {typeof value === "number" && Number.isFinite(value) &&
                          (key === "temperature_c" || value >= 0)
                            ? value.toLocaleString("id-ID", {
                                maximumFractionDigits: 1,
                              })
                            : "—"}
                          <small>{metricLabels[key][1]}</small>
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              )}
              {(fresh || node) && (
                <footer className="sensor-panel-footer">
                  {fresh ? (
                    <span>
                      <Radio size={13} />
                      {dateLabel(lastReadingTime)}
                    </span>
                  ) : (
                    node && (
                      <Link className="panel-link" to={`/nodes/${encodeURIComponent(node.id)}`}>
                        Lihat detail sensor <ArrowUpRight size={16} />
                      </Link>
                    )
                  )}
                  {node && (
                    <span>
                      Titik node: {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}
                    </span>
                  )}
                </footer>
              )}
              <ConditionScene scene="sensor" />
            </article>
            <aside className={`aero-assist assist-${summary.tone}`}>
              <span className="assist-orbit assist-orbit-one" aria-hidden="true" />
              <span className="assist-orbit assist-orbit-two" aria-hidden="true" />
              <div className="assist-copy">
                <h2>
                  {summary.tone === "danger"
                    ? "Periksa titik ini sekarang."
                    : summary.tone === "warning"
                      ? "Ada yang perlu dicek."
                      : "Tanya soal kondisi sekitar"}
                </h2>
                {summary.tone === "danger" && <p>Cek lokasi dan perangkat.</p>}
                {summary.tone === "warning" && <p>Bandingkan dengan titik terdekat.</p>}
              </div>
              <div className="assist-visual">
                <svg
                  className="assist-airflow"
                  viewBox="0 0 360 340"
                  fill="none"
                  aria-hidden="true"
                >
                  <ellipse cx="180" cy="230" rx="154" ry="54" transform="rotate(-20 180 230)" />
                  <path d="M28 160C74 116 123 122 165 145C213 171 283 172 330 120" />
                  <path d="M44 271C102 301 232 303 312 245" />
                </svg>
                {Array.from({ length: 7 }, (_, index) => (
                  <span
                    key={index}
                    className={`assist-particle particle-${index + 1}`}
                    aria-hidden="true"
                  />
                ))}
                <AeroMascot pose={pose} />
              </div>
              <Link to="/aerobot" className="assist-link">
                Tanya AERO-BOT <ArrowUpRight size={15} />
              </Link>
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
            <summary>
              <span>Arti status sensor</span>
              <ChevronDown size={17} />
            </summary>
            <div className="insight-detail-body">
              <p>
                Terpantau baik: pembacaan parameter udara berada di bawah ambang yang diatur.
                Waspada: ambang peringatan terlewati atau belum pulih. Bahaya: ambang bahaya yang
                diatur terlewati. Data lama, nilai tidak valid, atau aturan belum tersedia tidak
                diberi status bersih.
              </p>
              <p>
                Status ini mengikuti ambang perangkat. Indeks udara wilayah tersedia di Hub
                Lingkungan. TVOC adalah estimasi kelompok senyawa organik volatil.
              </p>
              {node?.rules?.map((r) => (
                <p key={r.metric}>
                  {metricLabels[r.metric]?.[0] || r.metric}: waspada ≥ {r.high} {r.unit}
                  {r.danger_high != null
                    ? ` · bahaya ≥ ${r.danger_high} ${r.unit}`
                    : " · ambang bahaya belum diatur"}
                  .
                </p>
              ))}
            </div>
          </details>
        </>
      )}
    </section>
  );
}

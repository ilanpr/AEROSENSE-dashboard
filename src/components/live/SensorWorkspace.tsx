import { NodeStatus } from "./NodeStatus";
import { MonitoringSelect } from "@/components/shared/MonitoringSelect";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RefreshCw, Download, MapPin, ArrowUpRight } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { useAuth } from "@/hooks/useAuth";
import { DataState } from "@/components/shared/DataState";
import {
  dateLabel,
  metricLabels,
  type LiveNode,
  type Reading,
  type Alert,
} from "@/types/live.types";
const LiveMap = lazy(() =>
  import("./LiveMap").then((m) => ({ default: m.LiveMap })),
);
const ReadingChart = lazy(() => import("./ReadingChart"));
import { api } from "@/services/api";
import { MonitoringScope } from "./MonitoringScope";

export function SensorWorkspace({
  mode = "overview",
}: {
  mode?:
    | "overview"
    | "map"
    | "nodes"
    | "detail"
    | "analytics"
    | "alerts"
    | "report";
}) {
  const { user, isLoading } = useAuth();
  const { id } = useParams();
  const dashboard = useLiveData<{ nodes: LiveNode[]; refreshed_at: string; report_scope?: Record<string, unknown> }>(
    mode === "report" ? (user ? "/v1/esg/report" : null) : `/v1/dashboard?account=${encodeURIComponent(user?.id || "guest")}`,
  );
  const [selected, setSelected] = useState("");
  const [metric, setMetric] = useState("dust_ug_m3");
  const [notice, setNotice] = useState("");
  const [ackBusy, setAckBusy] = useState(false);
  useEffect(() => {
    setSelected(id || "");
  }, [id]);
  const nodes = dashboard.data?.nodes || [];
  const node =
    nodes.find((n) => n.id === (id || selected)) ||
    (!id ? nodes[0] : undefined);
  const nodeQuery = node ? "?node_id=" + encodeURIComponent(node.id) : "";
  const history = useLiveData<{ readings: Reading[] }>(
    node && ["analytics", "detail", "report"].includes(mode)
      ? (mode === "report" ? "/v1/esg/report" : "/v1/history") + nodeQuery + "&account=" + encodeURIComponent(user?.id || "guest")
      : null,
    60000,
  );
  const alerts = useLiveData<{ alerts: Alert[] }>(
    node && ["overview", "alerts", "detail"].includes(mode)
      ? "/v1/alerts" + nodeQuery + "&account=" + encodeURIComponent(user?.id || "guest")
      : null,
  );
  const readings = history.data?.readings || [];
  const title = {
    overview: "Kondisi sensor",
    map: "Peta sensor",
    nodes: "Monitoring node",
    detail: node?.name || "Detail node",
    analytics: "Riwayat sensor",
    alerts: "Peringatan sensor",
    report: "Laporan lingkungan",
  }[mode];
  const chart = [...readings].reverse().map((r) => ({
    time: dateLabel(r.observed_at),
    reading: r.metrics[metric] ?? null,
    raw: r.raw_metrics?.[metric] ?? null,
    gru:
      r.gru?.target === metric && r.gru.horizon_seconds === 0
        ? r.gru.value
        : null,
  }));
  function exportReadings() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            report_type: "ambient_monitoring",
            node,
            readings,
            report_scope: dashboard.data?.report_scope,
            coverage: {
              reading_count: readings.length,
              from: readings.at(-1)?.observed_at ?? null,
              to: readings[0]?.observed_at ?? null,
              limit: 288,
            },
            limitations: [
              "Pembacaan asli dan hasil model harus ditafsirkan terpisah.",
              "Tidak menetapkan sumber pencemar, kepatuhan, skor ESG, atau jumlah emisi.",
              "Belum mendapat assurance independen.",
            ],
            exported_at: new Date().toISOString(),
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = "aerosense-" + node!.id + ".json";
    link.click();
    URL.revokeObjectURL(url);
  }
  if (mode === "overview") {
    const fresh = nodes.filter((n) => n.latest?.reading_id && !n.latest.stale);
    const older = nodes.filter((n) => !fresh.includes(n));
    return (
      <section className="sensor-workspace insights-hub">
        <header className="live-heading">
          <div>
            <h2>Sensor di lokasi Anda</h2>
            <p>Pembacaan langsung dari perangkat AEROSENSE.</p>
          </div>
          <Link to="/nodes" className="insight-text-link">
            Lihat perangkat <ArrowUpRight size={16} />
          </Link>
        </header>
        {isLoading || (dashboard.loading && !dashboard.data) ? (
          <DataState loading />
        ) : dashboard.error ? (
          <DataState error={dashboard.error} retry={dashboard.refresh} />
        ) : (
          <>
            {fresh.length ? (
              <div className="sensor-summary-list">
                {fresh.map((n) => (
                  <div className="sensor-summary-row" key={n.id}>
                    <MapPin size={20} />
                    <div>
                      <strong>{n.name}</strong><NodeStatus node={n} />
                      <p>
                        Pembacaan terbaru tersedia ·{" "}
                        {dateLabel(n.latest?.observed_at)}
                      </p>
                    </div>
                    <Link
                      to={`/nodes/${encodeURIComponent(n.id)}`}
                      className="insight-text-link"
                    >
                      Detail <ArrowUpRight size={15} />
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <DataState empty="Belum ada pembacaan sensor yang cukup baru. Informasi wilayah di atas tetap bisa Anda gunakan." />
            )}
            {older.length > 0 && (
              <details className="insight-disclosure">
                <summary>
                  <span>Perangkat yang menunggu pembaruan</span>
                  <span>{older.length}</span>
                </summary>
                <div className="sensor-summary-list">
                  {older.map((n) => (
                    <div className="sensor-summary-row" key={n.id}>
                      <MapPin size={18} />
                      <div>
                        <strong>{n.name}</strong><NodeStatus node={n} />
                        <p>
                          {n.latest?.reading_id
                            ? `Pembacaan terakhir ${dateLabel(n.latest.observed_at)}. Data ini sudah lama.`
                            : "Belum ada pembacaan dari perangkat."}
                        </p>
                      </div>
                      <Link
                        to={`/nodes/${encodeURIComponent(n.id)}`}
                        className="insight-text-link"
                      >
                        Detail <ArrowUpRight size={15} />
                      </Link>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </section>
    );
  }
  return (
    <section className="sensor-workspace">
      <header className="live-heading">
        <div>
          <h1>{title}</h1>
          <p>
            {mode === "report"
              ? "Riwayat sensor untuk pemeriksaan kondisi udara."
              : "Pembacaan node dan hasil model, terpisah dari informasi wilayah."}
          </p>
        </div>
        <button
          aria-label="Perbarui data sensor"
          className="live-icon-button"
          onClick={() => {
            dashboard.refresh();
            history.refresh();
            alerts.refresh();
          }}
        >
          <RefreshCw size={17} />
        </button>
      </header>
      {mode === "report" && <MonitoringScope report />}
      {isLoading ? (
        <DataState loading />
      ) : dashboard.error ? (
        <DataState error={dashboard.error} retry={dashboard.refresh} />
      ) : dashboard.loading && !dashboard.data ? (
        <DataState loading />
      ) : !nodes.length ? (
        <DataState empty="Belum ada node yang tersedia." />
      ) : (
        <>
          <div className="sensor-toolbar">
            <label>
              Node
              <MonitoringSelect label="Pilih node" value={node?.id || ""} disabled={!!id}
                onValueChange={setSelected} options={nodes.map(n => ({value:n.id,label:n.name}))} />
            </label>
            <span>Diperiksa {dateLabel(dashboard.data?.refreshed_at)}</span>
          </div>
          {node ? (
            <>
              <div className="sensor-location">
                <MapPin size={16} />
                <span>
                  {node.name} · {node.latitude}, {node.longitude}
                </span>
                <NodeStatus node={node} />
              </div>
              {["map", "nodes", "overview"].includes(mode) && (
                <Suspense fallback={<DataState loading />}>
                  <LiveMap
                    nodes={nodes}
                    selected={node.id}
                    onSelect={setSelected}
                  />
                </Suspense>
              )}
              {["overview", "detail", "analytics"].includes(mode) && (
                <>
                  <div className="sensor-values">
                    {Object.entries(metricLabels)
                      .filter(
                        ([k]) => k !== "pm25_ug_m3" || node.pm25_validated,
                      )
                      .map(([key, [label, unit]]) => (
                        <article key={key}>
                          <h2>{label}</h2>
                          <p>
                            {typeof node.latest?.metrics[key] === "number"
                              ? node.latest.metrics[key]!.toLocaleString(
                                  "id-ID",
                                  { maximumFractionDigits: 2 },
                                )
                              : "—"}{" "}
                            <small>{unit}</small>
                          </p>
                        </article>
                      ))}
                  </div>
                  <p className="hub-footnote">
                    Pembacaan: {dateLabel(node.latest?.observed_at)}. eCO₂
                    merupakan estimasi setara CO₂ dari sensor gas. Debu optik
                    tidak otomatis menjadi PM2.5 tervalidasi.
                  </p>
                </>
              )}
              {["nodes", "map", "overview"].includes(mode) && (
                <div className="live-table-wrap">
                  <table className="live-table">
                    <caption>Perangkat yang dapat Anda akses</caption>
                    <thead>
                      <tr>
                        <th>Node</th>
                        <th>Lokasi</th>
                        <th>Pembacaan terakhir</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nodes.map((n) => (
                        <tr key={n.id}>
                          <td>
                            <strong>{n.name}</strong><NodeStatus node={n} />
                            <small>{n.id}</small>
                          </td>
                          <td>
                            {n.latitude}, {n.longitude}
                          </td>
                          <td>{dateLabel(n.latest?.observed_at)}</td>
                          <td>
                            <Link
                              to={"/nodes/" + encodeURIComponent(n.id)}
                              aria-label={"Detail " + n.name}
                            >
                              <ArrowUpRight size={18} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {["detail", "analytics", "report"].includes(mode) && (
                <section className="live-panel">
                  <div className="live-heading">
                    <div>
                      <h2>Historis pembacaan</h2>
                      <p>Maksimal 288 pembacaan terakhir per node.</p>
                    </div>
                    <button
                      className="live-button secondary"
                      onClick={exportReadings}
                      disabled={!user || !readings.length || history.loading || !!history.error}
                      title={!user ? "Masuk untuk mengekspor data" : undefined}
                    >
                      <Download size={15} />
                      Ekspor JSON
                    </button>
                  </div>
                  {history.error ? (
                    <DataState error={history.error} retry={history.refresh} />
                  ) : history.loading && !history.data ? (
                    <DataState loading />
                  ) : !readings.length ? (
                    <DataState empty="Belum ada historis pembacaan sensor." />
                  ) : (
                    <>
                      <label className="metric-picker">
                        Parameter
                        <MonitoringSelect label="Pilih parameter" value={metric} onValueChange={setMetric}
                          options={Object.entries(metricLabels).filter(([k]) => k !== "pm25_ug_m3" || node.pm25_validated)
                            .map(([value,[label]]) => ({value,label}))} />
                      </label>
                      <Suspense fallback={<DataState loading />}>
                        <ReadingChart data={chart} />
                      </Suspense>
                      <p className="hub-footnote">
                        Prediksi GRU dengan horizon lebih dari 0 ditampilkan
                        terpisah pada rincian model, bukan sebagai koreksi pada
                        waktu pembacaan.
                      </p>
                    </>
                  )}
                  {node.latest?.gru ? (
                    <dl className="model-details">
                      <div>
                        <dt>Model</dt>
                        <dd>{node.latest.gru.model_version}</dd>
                      </div>
                      <div>
                        <dt>Target</dt>
                        <dd>
                          {metricLabels[node.latest.gru.target]?.[0] ||
                            node.latest.gru.target}
                        </dd>
                      </div>
                      <div>
                        <dt>Estimasi</dt>
                        <dd>
                          {node.latest.gru.value}{" "}
                          {metricLabels[node.latest.gru.target]?.[1]}
                        </dd>
                      </div>
                      <div>
                        <dt>Horizon</dt>
                        <dd>{node.latest.gru.horizon_seconds} detik</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="live-notice">
                      Belum ada hasil GRU untuk pembacaan terbaru.
                    </p>
                  )}
                </section>
              )}
              {["overview", "detail", "alerts"].includes(mode) && (
                <section className="live-panel">
                  <h2>Peringatan · {node.name}</h2>
                  {alerts.error ? (
                    <DataState error={alerts.error} retry={alerts.refresh} />
                  ) : alerts.loading && !alerts.data ? (
                    <DataState loading />
                  ) : !alerts.data?.alerts.length ? (
                    <p>Belum ada peringatan tersimpan untuk node ini.</p>
                  ) : (
                    <ul className="live-alerts">
                      {alerts.data.alerts.map((a) => (
                        <li key={a.id}>
                          <div>
                            <strong>
                              {metricLabels[a.metric]?.[0] || a.metric}:{" "}
                              {a.value} {a.unit}
                            </strong>
                            <p>
                              Ambang {a.threshold} {a.unit} ·{" "}
                              {dateLabel(a.created_at)}
                            </p>
                          </div>
                          {a.acknowledged_at ? (
                            <span className="live-tag">Sudah ditinjau</span>
                          ) : (
                            ["admin", "operator"].includes(node.role) && (
                              <button
                                className="live-button secondary"
                                disabled={ackBusy}
                                onClick={async () => {
                                  setAckBusy(true);
                                  try {
                                    await api.post("/v1/alerts/ack", {
                                      id: a.id,
                                    });
                                    alerts.refresh();
                                  } catch (e) {
                                    setNotice(
                                      e instanceof Error
                                        ? e.message
                                        : "Gagal menyimpan.",
                                    );
                                  } finally {
                                    setAckBusy(false);
                                  }
                                }}
                              >
                                Tandai ditinjau
                              </button>
                            )
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {notice && <p role="alert">{notice}</p>}
                </section>
              )}
              {mode === "report" && (
                <p className="live-notice">
                  Ekspor menyertakan cakupan waktu dan batas penggunaan data.
                  Penilaian ESG memerlukan bukti lain serta pemeriksaan sesuai
                  metodologi yang digunakan.
                </p>
              )}
            </>
          ) : (
            <DataState empty="Node tidak ditemukan atau aksesnya sudah dicabut." />
          )}
        </>
      )}
    </section>
  );
}

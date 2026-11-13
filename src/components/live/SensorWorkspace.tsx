import { NodeStatus } from "./NodeStatus";
import { MapSymbol } from "./MapSymbol";
import "@/styles/event-map.css";
import { MonitoringSelect } from "@/components/shared/MonitoringSelect";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { RefreshCw, Download, MapPin, ArrowUpRight, ChevronDown } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import type { WatersensePoint } from "./LiveMap";
import { useAuth } from "@/hooks/useAuth";
import { DataState } from "@/components/shared/DataState";
import {
  dateLabel,
  metricLabels,
  type LiveNode,
  type Reading,
  type Alert,
  type EnvironmentResponse,
} from "@/types/live.types";
const LiveMap = lazy(() => import("./LiveMap").then((m) => ({ default: m.LiveMap })));
const ReadingChart = lazy(() => import("./ReadingChart"));
import { api } from "@/services/api";
import { MonitoringScope } from "./MonitoringScope";
import { EsgReportPanel } from "./EsgReportPanel";
import { downloadCsv, readingsCsv } from "@/lib/csv-export";
import { gruChartValue, gruEstimates } from "@/lib/gru";
import { NodeRegistration } from "./NodeRegistration";
import { useAccess } from "@/hooks/useAccess";

export function SensorWorkspace({
  mode = "overview",
}: {
  mode?: "overview" | "map" | "nodes" | "detail" | "analytics" | "alerts" | "report";
}) {
  const { user, isLoading } = useAuth();
  const { canManage } = useAccess();
  const { id } = useParams();
  const [mapParams, setMapParams] = useSearchParams();
  const mapLayer = ["mixed", "events"].includes(mapParams.get("layer") || "")
    ? mapParams.get("layer")!
    : "sensors";
  const eventType = ["fire", "earthquake"].includes(mapParams.get("event_type") || "")
    ? mapParams.get("event_type")!
    : "all";
  const dashboard = useLiveData<{
    nodes: LiveNode[];
    refreshed_at: string;
    report_scope?: Record<string, unknown>;
  }>(
    mode === "report"
      ? user
        ? "/v1/esg/report"
        : null
      : `/v1/dashboard?account=${encodeURIComponent(user?.id || "guest")}`,
  );
  const [selected, setSelected] = useState("");
  const [previewNode, setPreviewNode] = useState<string | null>(null);
  const [metric, setMetric] = useState("dust_ug_m3");
  const [notice, setNotice] = useState("");
  const [ackBusy, setAckBusy] = useState(false);
  useEffect(() => {
    setSelected(id || "");
  }, [id]);
  const nodes = dashboard.data?.nodes || [];
  const node =
    nodes.find(
      (n) => n.id === (id || selected || (mode === "map" ? mapParams.get("node_id") : null)),
    ) || (!id ? nodes[0] : undefined);
  useEffect(() => {
    const available = Object.keys(metricLabels).find(
      (key) => typeof node?.latest?.metrics[key] === "number",
    );
    setMetric(available || "dust_ug_m3");
  }, [node?.id, !!node?.latest?.reading_id]);
  const nodeQuery = node ? "?node_id=" + encodeURIComponent(node.id) : "";
  const history = useLiveData<{ readings: Reading[]; detail?: "simple" | "model" }>(
    node && ["analytics", "detail", "report"].includes(mode)
      ? (mode === "report" ? "/v1/esg/report" : "/v1/history") +
          nodeQuery +
          "&account=" +
          encodeURIComponent(user?.id || "guest")
      : null,
    60000,
  );
  const alerts = useLiveData<{ alerts: Alert[] }>(
    node && ["overview", "alerts", "detail", "report"].includes(mode)
      ? "/v1/alerts" + nodeQuery + "&account=" + encodeURIComponent(user?.id || "guest")
      : null,
  );
  const readings = history.data?.readings || [];
  // The API decides: "model" for operators, admins and auditors; "simple" for guests and warga.
  const modelView = history.data?.detail === "model";
  const environment = useLiveData<EnvironmentResponse>(
    node && mode === "map"
      ? `/v1/environment?node_id=${encodeURIComponent(node.id)}&account=${encodeURIComponent(user?.id || "guest")}`
      : null,
    60000,
  );
  const events = (environment.data?.events || []).filter(
    (e) => eventType === "all" || e.category === eventType,
  );
  const watersense = useLiveData<{ actuators: WatersensePoint[] }>(
    user && mode === "map" ? `/v1/actuators/map?account=${encodeURIComponent(user.id)}` : null,
  );
  function changeMapParam(key: string, value: string) {
    const next = new URLSearchParams(mapParams);
    next.set(key, value);
    setMapParams(next);
  }
  const eventWarning =
    environment.error || (!environment.loading && !environment.data?.event_layers?.length)
      ? "Lokasi kejadian dari sumber publik belum tersedia."
      : environment.data?.event_layers?.some((l) => l.last_error || !l.available)
        ? "Sebagian sumber belum berhasil diperbarui."
        : "";
  const title = {
    overview: "Kondisi sensor",
    map: "Peta sensor",
    nodes: "Monitoring node",
    detail: node?.name || "Detail node",
    analytics: "Riwayat udara",
    alerts: "Peringatan sensor",
    report: "Laporan lingkungan",
  }[mode];
  const chart = [...readings].reverse().map((r) => ({
    time: dateLabel(r.observed_at),
    reading: r.metrics[metric] ?? null,
    raw: r.raw_metrics?.[metric] ?? null,
    gru: gruChartValue(r.gru, metric),
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
                      <strong>{n.name}</strong>
                      <NodeStatus node={n} />
                      <p>Pembacaan terbaru tersedia · {dateLabel(n.latest?.observed_at)}</p>
                    </div>
                    <Link to={`/nodes/${encodeURIComponent(n.id)}`} className="insight-text-link">
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
                        <strong>{n.name}</strong>
                        <NodeStatus node={n} />
                        <p>
                          {n.latest?.reading_id
                            ? `Pembacaan terakhir ${dateLabel(n.latest.observed_at)}. Data ini sudah lama.`
                            : "Belum ada pembacaan dari perangkat."}
                        </p>
                      </div>
                      <Link to={`/nodes/${encodeURIComponent(n.id)}`} className="insight-text-link">
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
        </div>
        <button
          aria-label="Perbarui data sensor"
          className="live-icon-button"
          onClick={() => {
            dashboard.refresh();
            history.refresh();
            alerts.refresh();
            environment.refresh();
          }}
        >
          <RefreshCw size={17} />
        </button>
      </header>
      {mode === "nodes" && canManage && (
        <NodeRegistration
          onCreated={(id) => {
            setSelected(id);
            dashboard.refresh();
          }}
        />
      )}
      {mode === "report" && <MonitoringScope />}
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
          {!["map", "nodes"].includes(mode) && (
            <div className="sensor-toolbar">
              <label>
                Node
                <MonitoringSelect
                  label="Pilih node"
                  value={node?.id || ""}
                  disabled={!!id}
                  onValueChange={setSelected}
                  options={nodes.map((n) => ({ value: n.id, label: n.name }))}
                />
              </label>
              <span>Diperiksa {dateLabel(dashboard.data?.refreshed_at)}</span>
            </div>
          )}
          {node ? (
            <>
              {!["map", "nodes"].includes(mode) && (
                <div className="sensor-location">
                  <MapPin size={16} />
                  <span>
                    {node.name} · {node.latitude}, {node.longitude}
                  </span>
                  <NodeStatus node={node} />
                </div>
              )}
              {mode === "map" && (
                <>
                  {mode === "map" && (
                    <div className="map-controls" data-public={mapLayer !== "sensors"}>
                      <div className="map-controls-main">
                        <div className="map-node-picker">
                          <MapPin size={17} aria-hidden="true" />
                          <MonitoringSelect
                            label="Titik acuan"
                            value={node.id}
                            onValueChange={setSelected}
                            onPreviewChange={setPreviewNode}
                            options={nodes.map((n) => ({ value: n.id, label: n.name }))}
                          />
                        </div>
                        <div className="map-layer-picker" role="group" aria-label="Isi peta">
                          {[
                            { id: "sensors", label: "Sensor", name: "Sensor saja" },
                            { id: "mixed", label: "Keduanya", name: "Sensor & kejadian" },
                            { id: "events", label: "Kejadian", name: "Kejadian publik" },
                          ].map((layer) => (
                            <button
                              key={layer.id}
                              aria-label={layer.name}
                              aria-pressed={mapLayer === layer.id}
                              onClick={() => changeMapParam("layer", layer.id)}
                            >
                              {layer.label}
                            </button>
                          ))}
                        </div>
                        {mapLayer !== "sensors" && (
                          <div className="map-kind-picker">
                            <MonitoringSelect
                              label="Jenis kejadian"
                              value={eventType}
                              onValueChange={(value) => changeMapParam("event_type", value)}
                              options={[
                                { value: "all", label: "Semua kejadian" },
                                { value: "fire", label: "Titik panas" },
                                { value: "earthquake", label: "Gempa" },
                              ]}
                            />
                          </div>
                        )}
                      </div>
                      <div className="map-controls-meta">
                        <span role="status">
                          {mapLayer !== "events" ? nodes.length + " node" : ""}
                          {mapLayer === "mixed" ? " · " : ""}
                          {mapLayer !== "sensors"
                            ? environment.loading && !environment.data
                              ? "Memuat kejadian…"
                              : events.length + " kejadian"
                            : ""}
                        </span>
                        <details className="map-info">
                          <summary>
                            Legenda & cakupan <ChevronDown size={14} aria-hidden="true" />
                          </summary>
                          <div className="map-info-content">
                            <div className="map-event-legend">
                              <span className="legend-sensor">
                                <MapSymbol kind="sensor" />
                                Node AEROSENSE
                              </span>
                              {!!watersense.data?.actuators.length && (
                                <span className="legend-watersense">
                                  <MapSymbol kind="watersense" />
                                  WATERSENSE
                                </span>
                              )}
                              <span className="legend-fire">
                                <MapSymbol kind="fire" />
                                Titik panas satelit
                              </span>
                              <span className="legend-earthquake">
                                <MapSymbol kind="earthquake" />
                                Episenter gempa BMKG
                              </span>
                            </div>
                            <p>
                              Titik acuan: <strong>{node.name}</strong>
                              <br />
                              {node.latitude}, {node.longitude}
                            </p>
                            <p>
                              Titik panas: feed 24 jam, radius 50 km. Deteksi satelit belum
                              mengonfirmasi kebakaran.
                            </p>
                            <p>
                              Gempa: daftar M5+ dalam 7 hari, radius 300 km. Tidak mencakup seluruh
                              gempa atau menunjukkan radius dampak.
                            </p>
                            <p>Diperiksa {dateLabel(dashboard.data?.refreshed_at)}</p>
                            <p>
                              Titik biru menunjukkan lokasi perangkat setelah Anda mengizinkan akses
                              lokasi. Koordinat tetap di peramban dan tidak dikirim ke server
                              AEROSENSE.
                            </p>
                          </div>
                        </details>
                      </div>
                      {mapLayer !== "sensors" && eventWarning && (
                        <p className="map-event-notice" role="status">
                          {eventWarning}
                        </p>
                      )}
                    </div>
                  )}
                  <Suspense fallback={<DataState loading />}>
                    <LiveMap
                      nodes={nodes}
                      selected={node.id}
                      previewed={previewNode}
                      locateUser
                      autoLocate={mapLayer === "sensors" && !mapParams.has("node_id")}
                      onSelect={setSelected}
                      showNodes={mode !== "map" || mapLayer !== "events"}
                      events={mode === "map" && mapLayer !== "sensors" ? events : []}
                      watersense={user ? watersense.data?.actuators : undefined}
                      focusedWatersense={mapParams.get("watersense")}
                      heatmap={mode === "map"}
                    />
                  </Suspense>
                </>
              )}
              {mode === "detail" && (
                <>
                  <div className="sensor-values">
                    {Object.entries(metricLabels)
                      .filter(([k]) => k !== "pm25_ug_m3" || node.pm25_validated)
                      .map(([key, [label, unit]]) => (
                        <article key={key}>
                          <h2>{label}</h2>
                          <p>
                            {typeof node.latest?.metrics[key] === "number"
                              ? node.latest.metrics[key]!.toLocaleString("id-ID", {
                                  maximumFractionDigits: 2,
                                })
                              : "—"}{" "}
                            <small>{unit}</small>
                          </p>
                        </article>
                      ))}
                  </div>
                  <p className="hub-footnote">
                    Pembacaan: {dateLabel(node.latest?.observed_at)}. Debu optik tidak otomatis menjadi PM2.5 tervalidasi.
                  </p>
                </>
              )}
              {mode === "nodes" && (
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
                            <strong>{n.name}</strong>
                            <NodeStatus node={n} />
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
              {mode === "report" && (
                <EsgReportPanel
                  node={node}
                  readings={readings}
                  alerts={alerts.data?.alerts || []}
                  scope={dashboard.data?.report_scope}
                  userEmail={user?.email}
                  loading={(history.loading && !history.data) || (alerts.loading && !alerts.data)}
                />
              )}
              {["detail", "analytics"].includes(mode) && (
                <section className="live-panel">
                  <div className="live-heading">
                    <div>
                      <h2>{modelView ? "Historis pembacaan & model" : "Riwayat 24 jam"}</h2>
                      <p>
                        {modelView
                          ? "Pembacaan sensor, input mentah, dan estimasi GRU ditampilkan terpisah."
                          : "Riwayat pembacaan sensor pada lokasi terpilih."}
                      </p>
                    </div>
                    {modelView && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="live-button secondary"
                          onClick={() =>
                            node &&
                            downloadCsv(
                              readingsCsv(node, readings, true),
                              `aerosense-pembacaan-${node.id}.csv`,
                            )
                          }
                          disabled={!user || !readings.length || history.loading || !!history.error}
                        >
                          <Download size={15} />
                          Unduh CSV
                        </button>
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
                    )}
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
                        <MonitoringSelect
                          label="Pilih parameter"
                          value={metric}
                          onValueChange={setMetric}
                          options={Object.entries(metricLabels)
                            .filter(([k]) => k !== "pm25_ug_m3" || node.pm25_validated)
                            .map(([value, [label]]) => ({ value, label }))}
                        />
                      </label>
                      {!modelView && <HistorySummary readings={readings} metric={metric} />}
                      <Suspense fallback={<DataState loading />}>
                        <ReadingChart data={chart} simple={!modelView} />
                      </Suspense>
                      <p className="hub-footnote">
                        {modelView
                          ? "Pembacaan sensor dan prediksi model ditampilkan terpisah."
                          : "Detail model dan ekspor data tersedia untuk operator, admin, dan auditor lokasi."}
                      </p>
                    </>
                  )}
                  {!modelView ? null : node.latest?.gru ? (
                    <>
                      <dl className="model-details">
                        <div>
                          <dt>Model</dt>
                          <dd>{node.latest.gru.model_version}</dd>
                        </div>
                        <div>
                          <dt>Tugas</dt>
                          <dd>
                            {node.latest.gru.task === "fault_detection"
                              ? "Pemeriksaan gangguan sensor"
                              : "Estimasi parameter"}
                          </dd>
                        </div>
                        <div>
                          <dt>Mode</dt>
                          <dd>
                            {node.latest.gru.mode === "shadow"
                              ? "Pembanding · tidak mengganti pembacaan"
                              : node.latest.gru.mode || "Estimasi terpisah"}
                          </dd>
                        </div>
                        <div>
                          <dt>Horizon</dt>
                          <dd>{node.latest.gru.horizon_seconds} detik</dd>
                        </div>
                      </dl>
                      <div className="live-table-wrap">
                        <table className="live-table">
                          <thead>
                            <tr>
                              <th>Parameter</th>
                              <th>Pembacaan sensor</th>
                              <th>Estimasi GRU</th>
                              <th>Skor gangguan</th>
                              <th>Ambang skor</th>
                              <th>Pemeriksaan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(gruEstimates(node.latest.gru))
                              .filter(([key]) => key !== "pm25_ug_m3" || node.pm25_validated)
                              .map(([key, value]) => {
                                const g = node.latest!.gru!;
                                const fmt = (v: number | null | undefined) =>
                                  typeof v === "number" && Number.isFinite(v)
                                    ? v.toLocaleString("id-ID", { maximumFractionDigits: 3 })
                                    : "—";
                                return (
                                  <tr key={key}>
                                    <td>{metricLabels[key]?.[0] || key}</td>
                                    <td>
                                      {fmt(node.latest!.metrics[key])} {metricLabels[key]?.[1]}
                                    </td>
                                    <td>
                                      {fmt(value)} {metricLabels[key]?.[1]}
                                    </td>
                                    <td>{fmt(g.fault_scores?.[key])}</td>
                                    <td>{fmt(g.thresholds?.[key])}</td>
                                    <td>
                                      {g.task === "fault_detection"
                                        ? g.suspect?.includes(key)
                                          ? "Perlu diperiksa"
                                          : "Tidak ditandai"
                                        : "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                      <p className="hub-footnote">
                        <time dateTime={node.latest.gru.processed_at}>
                          {dateLabel(node.latest.gru.processed_at)}
                        </time>
                      </p>
                    </>
                  ) : (
                    <p className="live-notice">Belum ada hasil GRU untuk pembacaan terbaru.</p>
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
                              {metricLabels[a.metric]?.[0] || a.metric}: {a.value} {a.unit}
                            </strong>
                            <p>
                              Ambang {a.threshold} {a.unit} · {dateLabel(a.created_at)}
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
                                    setNotice(e instanceof Error ? e.message : "Gagal menyimpan.");
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
                  Ekspor menyertakan cakupan waktu dan batas penggunaan data. Penilaian ESG
                  memerlukan bukti lain serta pemeriksaan sesuai metodologi yang digunakan.
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

// Plain-language summary for guests and warga: average, highest and lowest of the shown readings.
function HistorySummary({ readings, metric }: { readings: Reading[]; metric: string }) {
  const points = readings
    .filter((r) => r.quality?.invalid !== true && typeof r.metrics[metric] === "number")
    .map((r) => ({ at: r.observed_at, value: r.metrics[metric] as number }));
  if (!points.length) return null;
  const [label, unit] = metricLabels[metric] || [metric, ""];
  const avg = points.reduce((a, p) => a + p.value, 0) / points.length;
  const high = points.reduce((a, p) => (p.value > a.value ? p : a));
  const low = points.reduce((a, p) => (p.value < a.value ? p : a));
  const fmt = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  return (
    <dl className="history-summary">
      <div>
        <dt>Rata-rata {label.toLowerCase()}</dt>
        <dd>
          {fmt(avg)} <small>{unit}</small>
        </dd>
      </div>
      <div>
        <dt>Tertinggi</dt>
        <dd>
          {fmt(high.value)}{" "}
          <small>
            {unit} · {dateLabel(high.at)}
          </small>
        </dd>
      </div>
      <div>
        <dt>Terendah</dt>
        <dd>
          {fmt(low.value)}{" "}
          <small>
            {unit} · {dateLabel(low.at)}
          </small>
        </dd>
      </div>
    </dl>
  );
}

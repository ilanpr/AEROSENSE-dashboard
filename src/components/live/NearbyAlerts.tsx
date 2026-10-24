import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CheckCircle2, ChevronDown, LocateFixed, MapPin, Navigation, RefreshCw, TriangleAlert } from "lucide-react";
import { DEMO_MODE } from "@/lib/demo-mode";
import { nearbyNodes, distanceLabel, validPoint, type GeoPoint } from "@/lib/nearby-nodes";
import { useLiveData } from "@/hooks/useLiveData";
import type { LiveNode } from "@/types/live.types";
import { DataState } from "@/components/shared/DataState";
import { NodeStatus } from "./NodeStatus";
import { NodeReadings } from "./NodeReadings";
import "@/styles/nearby-alerts.css";

const LiveMap = lazy(() => import("./LiveMap").then(m => ({ default: m.LiveMap })));
const demoPoint = { latitude: -7.299, longitude: 112.759 };
export function NearbyAlerts() {
  const dashboard = useLiveData<{ nodes: LiveNode[] }>(DEMO_MODE ? "/v1/dashboard" : "/v1/public/dashboard", 30000, false);
  const [point, setPoint] = useState<GeoPoint | null>(DEMO_MODE ? demoPoint : null);
  const [source, setSource] = useState<"demo" | "device" | null>(DEMO_MODE ? "demo" : null);
  const [radius, setRadius] = useState(5);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [selected, setSelected] = useState("");
  const nodes = nearbyNodes(dashboard.data?.nodes || [], point, radius);
  const danger = nodes.filter(x => x.status.tone === "danger");
  const warning = nodes.filter(x => x.status.tone === "warning");
  const pending = nodes.filter(x => x.status.tone === "pending");
  const raised = nodes.filter(x => x.status.tone === "danger" || x.status.tone === "warning");
  const other = nodes.filter(x => x.status.tone !== "danger" && x.status.tone !== "warning");
  const coverage = point ? `${nodes.length} node dalam ${distanceLabel(radius)}` : "Aktifkan lokasi untuk melihat node terdekat.";
  function locate() {
    setLocationError("");
    if (!navigator.geolocation) { setLocationError("Peramban ini belum mendukung lokasi perangkat."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(result => {
      const next = { latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy };
      setLocating(false);
      if (!validPoint(next)) { setLocationError("Koordinat belum terbaca. Coba lagi."); return; }
      setPoint(next); setSource("device"); setSelected("");
    }, error => {
      setLocating(false);
      setLocationError(error.code === 1 ? "Izin lokasi ditolak. Izinkan lokasi melalui pengaturan situs, lalu coba lagi." : error.code === 3 ? "Lokasi belum ditemukan. Coba di area dengan sinyal lebih baik." : "Lokasi perangkat belum tersedia. Periksa layanan lokasi lalu coba lagi.");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  function card(item: typeof nodes[number]) {
    return <article className={`nearby-node nearby-node-${item.status.tone}`} key={item.node.id}>
      <header><div><h3>{item.node.name}</h3><span className="nearby-distance"><MapPin size={13} aria-hidden="true" />{distanceLabel(item.distance)} {source === "demo" ? "dari titik contoh" : "dari Anda"}</span></div><NodeStatus node={item.node} /></header>
      <NodeReadings node={item.node} />
      <footer><span>{item.status.tone === "danger" ? "Minta pengelola memeriksa lokasi dan sensor." : item.status.tone === "warning" ? "Pantau perubahan dan cek kondisi di lokasi." : item.status.tone === "pending" ? "Tunggu pembacaan yang valid dan terbaru." : "Di bawah ambang sensor yang diatur."}</span><Link to={`/nodes/${encodeURIComponent(item.node.id)}`}>Detail node <ArrowUpRight size={14} /></Link></footer>
    </article>;
  }
  return <section className="nearby-alerts">
    <header className="live-heading"><div><h1>Peringatan sekitar</h1><p>Node yang perlu diperiksa di dekat Anda.</p></div><button className="live-icon-button" aria-label="Perbarui status node sekitar" onClick={dashboard.refresh}><RefreshCw size={17} /></button></header>
    <div className="nearby-location">
      <span className="nearby-location-icon"><Navigation size={22} aria-hidden="true" /></span>
      <div><strong>{source === "demo" ? "Lokasi contoh · Surabaya" : source === "device" ? "Lokasi perangkat" : "Gunakan lokasi Anda"}</strong><p>{coverage}{source === "demo" ? " · simulasi" : ""}</p></div>
      <button className="live-button nearby-locate" disabled={locating} onClick={locate}><LocateFixed size={16} />{locating ? "Mencari lokasi…" : source === "device" ? "Perbarui lokasi" : "Gunakan lokasi saya"}</button>
    </div>
    {locationError && <p className="nearby-location-error" role="alert">{locationError}</p>}
    {point?.accuracy != null && point.accuracy > 1000 && <p className="nearby-location-error">Lokasi masih berupa perkiraan (±{distanceLabel(point.accuracy / 1000)}). Jarak node dapat berbeda.</p>}
    {point && <div className="nearby-radius"><span>Radius</span><div role="group" aria-label="Radius pemantauan">{[2.5, 5, 10].map(value => <button key={value} aria-pressed={radius === value} onClick={() => setRadius(value)}>{distanceLabel(value)}</button>)}</div></div>}
    {dashboard.error ? <DataState error={dashboard.error} retry={dashboard.refresh} /> : dashboard.loading && !dashboard.data ? <DataState loading /> : !point ? <div className="nearby-empty"><LocateFixed size={32} /><h2>Di mana Anda berada?</h2><p>Izinkan lokasi untuk mencari node sekitar.</p><span>Koordinat diproses di peramban dan tidak disimpan.</span></div> : <>
      <div className={`nearby-summary ${raised.length ? "has-alerts" : ""}`} aria-live="polite">
        {raised.length ? <TriangleAlert size={28} aria-hidden="true" /> : <CheckCircle2 size={28} aria-hidden="true" />}
        <div><h2>{!nodes.length ? "Belum ada node terjangkau." : raised.length ? `${raised.length} node perlu diperiksa.` : pending.length === nodes.length ? "Pembacaan belum tersedia." : "Tidak ada ambang peringatan terlewati."}</h2><p>{!nodes.length ? "Coba radius yang lebih luas." : <><strong>{danger.length} bahaya</strong> · {warning.length} waspada · {nodes.length} node terjangkau{pending.length ? ` · ${pending.length} menunggu data` : ""}</>}</p></div>
      </div>
      <div className="nearby-layout">
        <div className="nearby-results"><div className="nearby-section-title"><h2>{raised.length ? "Perlu perhatian" : "Node terdekat"}</h2><span>{raised.length || nodes.length} node</span></div>
          {raised.length ? raised.map(card) : other.slice(0, 3).map(card)}
          {(raised.length > 0 ? other.length > 0 : other.length > 3) && <details className="insight-disclosure nearby-other"><summary><span>Node lainnya ({raised.length ? other.length : other.length - 3})</span><ChevronDown size={16} /></summary><div>{(raised.length ? other : other.slice(3)).map(card)}</div></details>}
          {!nodes.length && <p className="nearby-coverage-note">Tidak ada pembacaan lokal yang dapat menyimpulkan kondisi di titik ini.</p>}
        </div>
        <aside className="nearby-map-panel"><div className="nearby-section-title"><h2>Peta sekitar</h2><span>{source === "demo" ? "Titik biru: contoh" : "Titik biru: Anda"}</span></div><Suspense fallback={<DataState loading />}><LiveMap nodes={nodes.map(x => x.node)} selected={selected} onSelect={setSelected} userLocation={point} radiusKm={radius} locationLabel={source === "demo" ? "Lokasi contoh" : "Lokasi Anda"} /></Suspense><p>Klik node untuk melihat pembacaannya.</p></aside>
      </div>
    </>}
    <details className="insight-disclosure nearby-method"><summary><span>Lokasi & cara membaca status</span><ChevronDown size={16} /></summary><div className="insight-detail-body"><p>Jarak dihitung garis lurus dari lokasi perangkat, bukan rute perjalanan. Halaman memakai node yang dipublikasikan pengelola. Status mengikuti pembacaan terbaru dan ambang sensor; data lama atau tidak valid ditandai menunggu data.</p><p>Status bukan AQI, jaminan kesehatan, atau bukti sumber pencemar. eCO₂ adalah estimasi sensor gas. Lokasi hanya dipakai pada halaman ini, tanpa disimpan atau dikirim ke server AEROSENSE.</p>{point && <p>{source === "demo" ? "Titik contoh" : "Lokasi perangkat"}: {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}{point.accuracy != null ? ` · perkiraan ketelitian ±${Math.round(point.accuracy)} m` : ""}.</p>}</div></details>
  </section>;
}

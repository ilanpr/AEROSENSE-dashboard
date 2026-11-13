import { sensorSummary } from "@/lib/environment-presentation";
import { NodeStatus } from "./NodeStatus";
import { NodeReadings } from "./NodeReadings";
import { mapIcon } from "./map-icons";
import { HeatField, HeatLegend, HEAT_LAYERS, type HeatLayerKey } from "./HeatField";
import { DeviceLocation } from "./DeviceLocation";
import { Link } from "react-router-dom";
import type { GeoPoint } from "@/lib/nearby-nodes";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Pane,
  CircleMarker,
  Circle,
  Marker,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import { dateLabel, type EnvironmentEvent, type LiveNode } from "@/types/live.types";
import "leaflet/dist/leaflet.css";
import "@/styles/event-map.css";
export type WatersensePoint = GeoPoint & {
  id: string;
  name: string;
  node_id: string;
  online: boolean;
};

function WatersenseFocus({ point }: { point?: WatersensePoint }) {
  const map = useMap();
  const id = point?.id;
  const latitude = point?.latitude;
  const longitude = point?.longitude;
  useEffect(() => {
    if (id && latitude != null && longitude != null) map.setView([latitude, longitude], 16);
  }, [map, id, latitude, longitude]);
  return null;
}
function EventFocus({ nodes, events }: { nodes: LiveNode[]; events: EnvironmentEvent[] }) {
  const map = useMap();
  const signature = JSON.stringify([...nodes, ...events].map((p) => [p.latitude, p.longitude]));
  useEffect(() => {
    const points = JSON.parse(signature) as [number, number][];
    if (points.length) map.fitBounds(points, { padding: [35, 35], maxZoom: 13 });
  }, [map, signature]);
  return null;
}
function Focus({ node, nodes }: { node?: LiveNode; nodes: LiveNode[] }) {
  const map = useMap();
  const focused = useRef(false);
  const latitude = node?.latitude,
    longitude = node?.longitude;
  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    if (!focused.current && nodes.length > 1) {
      map.fitBounds(
        nodes.map((n) => [n.latitude, n.longitude] as [number, number]),
        { padding: [28, 28], maxZoom: 13 },
      );
    } else if (!focused.current) {
      map.setView([latitude, longitude], 13);
    } else {
      map.panTo([latitude, longitude]);
    }
    focused.current = true;
  }, [latitude, longitude, map]);
  return null;
}
function LocationFocus({ point, radiusKm }: { point: GeoPoint; radiusKm: number }) {
  const map = useMap();
  useEffect(() => {
    const dy = radiusKm / 111.2;
    const dx = dy / Math.max(0.01, Math.cos((point.latitude * Math.PI) / 180));
    map.fitBounds(
      [
        [point.latitude - dy, point.longitude - dx],
        [point.latitude + dy, point.longitude + dx],
      ],
      { padding: [20, 20], maxZoom: 14 },
    );
  }, [map, point.latitude, point.longitude, radiusKm]);
  return null;
}
function SelectionFocus({ node }: { node?: LiveNode }) {
  const map = useMap();
  const lastId = useRef(node?.id);
  useEffect(() => {
    if (!node || node.id === lastId.current) return;
    lastId.current = node.id;
    map.panInside([node.latitude, node.longitude], { padding: [56, 56], animate: false });
  }, [map, node]);
  return null;
}
export function LiveMap({
  nodes,
  selected,
  previewed,
  onSelect,
  userLocation,
  radiusKm = 5,
  locationLabel = "Lokasi Anda",
  events = [],
  showNodes = true,
  locateUser = false,
  autoLocate = false,
  watersense = [],
  focusedWatersense,
  heatmap = false,
}: {
  nodes: LiveNode[];
  selected: string;
  previewed?: string | null;
  onSelect: (id: string) => void;
  userLocation?: GeoPoint;
  radiusKm?: number;
  locationLabel?: string;
  events?: EnvironmentEvent[];
  showNodes?: boolean;
  locateUser?: boolean;
  autoLocate?: boolean;
  watersense?: WatersensePoint[];
  focusedWatersense?: string | null;
  /** Model heatmap controls; only the full sensor map has room for them. */
  heatmap?: boolean;
}) {
  const [devicePoint, setDevicePoint] = useState<GeoPoint | null>(null);
  const [heat, setHeat] = useState<HeatLayerKey | "off">(heatmap ? "temperature" : "off");
  const [heatInfo, setHeatInfo] = useState<{
    source: string;
    valid_at: string | null;
    error?: string;
  } | null>(null);
  const locationPoint = userLocation || devicePoint;
  const valid = nodes.filter(
    (n) =>
      Number.isFinite(n.latitude) &&
      Number.isFinite(n.longitude) &&
      Math.abs(n.latitude) <= 90 &&
      Math.abs(n.longitude) <= 180,
  );
  const active = valid.find((n) => n.id === selected) || valid[0];
  const highlighted = valid.find((n) => n.id === (previewed || selected));
  const eventPoints = events.filter(
    (e) =>
      Number.isFinite(e.latitude) &&
      Number.isFinite(e.longitude) &&
      Math.abs(e.latitude) <= 90 &&
      Math.abs(e.longitude) <= 180,
  );
  if (!active && !userLocation)
    return <p className="live-notice">Koordinat node belum tersedia.</p>;
  return (
    <div className={"live-map" + (heat !== "off" ? " heat-on" : "")}>
      {heatmap && (
        <div className="heat-controls" role="group" aria-label="Lapisan heatmap">
          {(["off", ...Object.keys(HEAT_LAYERS)] as (HeatLayerKey | "off")[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={heat === k}
              className={heat === k ? "is-on" : ""}
              onClick={() => setHeat(k)}
            >
              {k === "off" ? "Mati" : HEAT_LAYERS[k].label}
            </button>
          ))}
        </div>
      )}
      {heat !== "off" && <HeatLegend layer={heat} info={heatInfo} />}
      <MapContainer
        center={
          userLocation
            ? [userLocation.latitude, userLocation.longitude]
            : [active!.latitude, active!.longitude]
        }
        zoom={13}
        minZoom={7}
        maxBounds={[
          [-85.05, -180],
          [85.05, 180],
        ]}
        maxBoundsViscosity={1}
        className="h-full w-full"
      >
        {userLocation ? (
          <LocationFocus point={userLocation} radiusKm={radiusKm} />
        ) : eventPoints.length ? (
          <EventFocus nodes={showNodes ? valid : []} events={eventPoints} />
        ) : devicePoint ? null : (
          <Focus node={active} nodes={valid} />
        )}
        {!userLocation && showNodes && <SelectionFocus node={highlighted} />}
        {showNodes && (
          <WatersenseFocus point={watersense.find((point) => point.id === focusedWatersense)} />
        )}
        {locateUser && (
          <DeviceLocation point={devicePoint} onPoint={setDevicePoint} autoLocate={autoLocate} />
        )}
        {heat === "off" ? (
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            noWrap
            className="live-map-tiles"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
        ) : (
          <>
            {/* Clean base with coastlines and borders; colour field above; place names on top. */}
            <TileLayer
              key="heat-base"
              url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
              noWrap
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <Pane name="heatPane" style={{ zIndex: 350 }} />
            <Pane name="heatLabelsPane" style={{ zIndex: 450, pointerEvents: "none" }}>
              <TileLayer
                key="heat-labels"
                url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                noWrap
                pane="heatLabelsPane"
              />
            </Pane>
          </>
        )}
        {locationPoint && (
          <>
            {userLocation && (
              <Circle
                center={[userLocation.latitude, userLocation.longitude]}
                radius={radiusKm * 1000}
                pathOptions={{ color: "#0b6fe5", weight: 1, dashArray: "5 7", fillOpacity: 0.04 }}
                interactive={false}
              />
            )}
            {locationPoint.accuracy != null && (
              <Circle
                center={[locationPoint.latitude, locationPoint.longitude]}
                radius={locationPoint.accuracy}
                pathOptions={{ color: "#0b6fe5", weight: 1, fillOpacity: 0.1 }}
                interactive={false}
              />
            )}
            <CircleMarker
              center={[locationPoint.latitude, locationPoint.longitude]}
              radius={7}
              pathOptions={{ color: "#fff", weight: 3, fillColor: "#076cfb", fillOpacity: 1 }}
            >
              <Tooltip direction="top" offset={[0, -10]}>
                {locationLabel}
              </Tooltip>
              <Popup>
                <strong>{locationLabel}</strong>
                {locationPoint.accuracy != null && (
                  <p>
                    Perkiraan akurasi ±{Math.round(locationPoint.accuracy).toLocaleString("id-ID")}{" "}
                    m.
                  </p>
                )}
              </Popup>
            </CircleMarker>
          </>
        )}
        {heat !== "off" && <HeatField layer={heat} onInfo={setHeatInfo} />}
        {showNodes &&
          valid.map((n) => (
            <Marker
              key={n.id}
              position={[n.latitude, n.longitude]}
              icon={mapIcon("sensor", sensorSummary(n).tone, n.id === highlighted?.id)}
              zIndexOffset={n.id === highlighted?.id ? 1000 : 0}
              title={n.name}
              alt={`Sensor ${n.name}`}
              eventHandlers={{ click: () => onSelect(n.id) }}
            >
              {n.id === highlighted?.id && (
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -20]}
                  opacity={1}
                  className="node-focus-tooltip"
                >
                  {n.name}
                </Tooltip>
              )}
              <Popup minWidth={250} maxWidth={290} className="node-reading-popup">
                <strong className="node-popup-title">{n.name}</strong>
                <NodeStatus node={n} />
                <NodeReadings node={n} />
                <Link className="node-popup-detail" to={`/nodes/${encodeURIComponent(n.id)}`}>
                  Lihat detail node <ArrowUpRight size={13} aria-hidden="true" />
                </Link>
              </Popup>
            </Marker>
          ))}
        {showNodes &&
          watersense.map((point) => (
            <Marker
              key={"watersense-" + point.id}
              position={[point.latitude, point.longitude]}
              title={point.name}
              alt={`WATERSENSE ${point.name}`}
              icon={mapIcon("watersense", "watersense", point.id === focusedWatersense)}
              zIndexOffset={point.id === focusedWatersense ? 1500 : 500}
            >
              <Tooltip direction="top" offset={[0, -18]}>
                {point.name}
              </Tooltip>
              <Popup className="node-reading-popup">
                <strong className="node-popup-title">{point.name}</strong>
                <p>WATERSENSE · {point.online ? "Terhubung" : "Offline"}</p>
                <p>
                  {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                </p>
              </Popup>
            </Marker>
          ))}
        {eventPoints.map((e) => (
          <Marker
            key={e.id}
            position={[e.latitude, e.longitude]}
            icon={mapIcon(e.category)}
            title={e.title}
            alt={e.category === "fire" ? "Titik panas satelit" : "Episenter gempa"}
            opacity={e.stale ? 0.55 : 1}
          >
            <Popup minWidth={240} maxWidth={290} className="event-popup">
              <strong>{e.category === "fire" ? "Titik panas satelit" : "Gempa BMKG"}</strong>
              <p>
                {e.category === "earthquake"
                  ? e.title
                  : "Deteksi anomali termal; belum konfirmasi kebakaran."}
              </p>
              <dl>
                {e.category === "fire" ? (
                  <>
                    <dt>Keyakinan deteksi</dt>
                    <dd>
                      {(
                        { low: "Rendah", nominal: "Nominal", high: "Tinggi" } as Record<
                          string,
                          string
                        >
                      )[e.confidence || ""] || "Tidak tersedia"}
                    </dd>
                  </>
                ) : (
                  <>
                    <dt>Magnitudo</dt>
                    <dd>{e.magnitude?.toLocaleString("id-ID")}</dd>
                    <dt>Kedalaman</dt>
                    <dd>{e.depth_km != null ? `${e.depth_km} km` : "Tidak tersedia"}</dd>
                  </>
                )}
                <dt>Waktu kejadian</dt>
                <dd>{dateLabel(e.observed_at)}</dd>
                <dt>Koordinat</dt>
                <dd>
                  {e.latitude.toFixed(4)}, {e.longitude.toFixed(4)}
                </dd>
              </dl>
              {e.stale && <p className="event-stale">Pembaruan tertunda; periksa waktu data.</p>}
              {e.felt && <p>{e.felt}</p>}
              <a href={e.source_url} target="_blank" rel="noreferrer">
                {e.source} <ArrowUpRight size={12} />
              </a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

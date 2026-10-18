import { sensorSummary } from "@/lib/environment-presentation";
import { NodeStatus } from "./NodeStatus";
import { NodeReadings } from "./NodeReadings";
import { mapIcon } from "./map-icons";
import { Link } from "react-router-dom";
import type { GeoPoint } from "@/lib/nearby-nodes";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import { dateLabel, type EnvironmentEvent, type LiveNode } from "@/types/live.types";
import "leaflet/dist/leaflet.css";
import "@/styles/event-map.css";
function EventFocus({ nodes, events }: {nodes:LiveNode[];events:EnvironmentEvent[]}) {
  const map=useMap();
  const signature=JSON.stringify([...nodes,...events].map(p=>[p.latitude,p.longitude]));
  useEffect(()=>{const points=JSON.parse(signature) as [number,number][];if(points.length)map.fitBounds(points,{padding:[35,35],maxZoom:13});},[map,signature]);
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
      map.fitBounds(nodes.map(n => [n.latitude, n.longitude] as [number, number]), {padding:[28,28],maxZoom:13});
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
    const dx = dy / Math.max(0.01, Math.cos(point.latitude * Math.PI / 180));
    map.fitBounds([[point.latitude - dy, point.longitude - dx], [point.latitude + dy, point.longitude + dx]], { padding: [20, 20], maxZoom: 14 });
  }, [map, point.latitude, point.longitude, radiusKm]);
  return null;
}
export function LiveMap({
  nodes,
  selected,
  onSelect,
  userLocation,
  radiusKm = 5,
  locationLabel = "Lokasi Anda",
  events = [],
  showNodes = true,
}: {
  nodes: LiveNode[];
  selected: string;
  onSelect: (id: string) => void;
  userLocation?: GeoPoint;
  radiusKm?: number;
  locationLabel?: string;
  events?: EnvironmentEvent[];
  showNodes?: boolean;
}) {
  const valid = nodes.filter(
    (n) =>
      Number.isFinite(n.latitude) &&
      Number.isFinite(n.longitude) &&
      Math.abs(n.latitude) <= 90 &&
      Math.abs(n.longitude) <= 180,
  );
  const active = valid.find((n) => n.id === selected) || valid[0];
  const eventPoints=events.filter(e=>Number.isFinite(e.latitude)&&Number.isFinite(e.longitude)&&Math.abs(e.latitude)<=90&&Math.abs(e.longitude)<=180);
  if (!active && !userLocation)
    return <p className="live-notice">Koordinat node belum tersedia.</p>;
  return (
    <div className="live-map">
      <MapContainer
        center={userLocation ? [userLocation.latitude, userLocation.longitude] : [active!.latitude, active!.longitude]}
        zoom={13}
        className="h-full w-full"
      >
        {userLocation ? <LocationFocus point={userLocation} radiusKm={radiusKm} /> : eventPoints.length ? <EventFocus nodes={showNodes?valid:[]} events={eventPoints} /> : <Focus node={active} nodes={valid} />}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {userLocation && <>
          <Circle center={[userLocation.latitude, userLocation.longitude]} radius={radiusKm * 1000} pathOptions={{ color: "#0b6fe5", weight: 1, dashArray: "5 7", fillOpacity: 0.04 }} interactive={false} />
          {userLocation.accuracy != null && <Circle center={[userLocation.latitude, userLocation.longitude]} radius={userLocation.accuracy} pathOptions={{ color: "#0b6fe5", weight: 1, fillOpacity: 0.1 }} interactive={false} />}
          <CircleMarker center={[userLocation.latitude, userLocation.longitude]} radius={7} pathOptions={{ color: "#fff", weight: 3, fillColor: "#076cfb", fillOpacity: 1 }}><Popup>{locationLabel}</Popup></CircleMarker>
        </>}
        {showNodes && valid.map((n) => (
          <Marker
            key={n.id}
            position={[n.latitude, n.longitude]}
            icon={mapIcon("sensor",sensorSummary(n).tone)}
            title={n.name}
            alt={`Sensor ${n.name}`}
            eventHandlers={{ click: () => onSelect(n.id) }}
          >
            <Popup minWidth={250} maxWidth={290} className="node-reading-popup">
              <strong className="node-popup-title">{n.name}</strong>
              <NodeStatus node={n} />
              <NodeReadings node={n} />
              <Link className="node-popup-detail" to={`/nodes/${encodeURIComponent(n.id)}`}>Lihat detail node <ArrowUpRight size={13} aria-hidden="true" /></Link>
            </Popup>
          </Marker>
        ))}
        {eventPoints.map(e=><Marker key={e.id} position={[e.latitude,e.longitude]} icon={mapIcon(e.category)} title={e.title} alt={e.category==="fire"?"Titik panas satelit":"Episenter gempa"} opacity={e.stale?.55:1}>
          <Popup minWidth={240} maxWidth={290} className="event-popup"><strong>{e.category==="fire"?"Titik panas satelit":"Gempa BMKG"}</strong>
            <p>{e.category==="earthquake"?e.title:"Deteksi anomali termal; belum konfirmasi kebakaran."}</p>
            <dl>{e.category==="fire"?<><dt>Keyakinan deteksi</dt><dd>{({low:"Rendah",nominal:"Nominal",high:"Tinggi"} as Record<string,string>)[e.confidence||""]||"Tidak tersedia"}</dd></>:<><dt>Magnitudo</dt><dd>{e.magnitude?.toLocaleString("id-ID")}</dd><dt>Kedalaman</dt><dd>{e.depth_km!=null?`${e.depth_km} km`:"Tidak tersedia"}</dd></>}<dt>Waktu kejadian</dt><dd>{dateLabel(e.observed_at)}</dd><dt>Koordinat</dt><dd>{e.latitude.toFixed(4)}, {e.longitude.toFixed(4)}</dd></dl>
            {e.stale&&<p className="event-stale">Pembaruan tertunda; periksa waktu data.</p>}
            {e.felt&&<p>{e.felt}</p>}<a href={e.source_url} target="_blank" rel="noreferrer">{e.source} <ArrowUpRight size={12} /></a>
          </Popup>
        </Marker>)}
      </MapContainer>
    </div>
  );
}

import { sensorSummary } from "@/lib/environment-presentation";
import { NodeStatus } from "./NodeStatus";
import { NodeReadings } from "./NodeReadings";
import { Link } from "react-router-dom";
import type { GeoPoint } from "@/lib/nearby-nodes";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Popup,
  useMap,
} from "react-leaflet";
import type { LiveNode } from "@/types/live.types";
import "leaflet/dist/leaflet.css";
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
}: {
  nodes: LiveNode[];
  selected: string;
  onSelect: (id: string) => void;
  userLocation?: GeoPoint;
  radiusKm?: number;
  locationLabel?: string;
}) {
  const valid = nodes.filter(
    (n) =>
      Number.isFinite(n.latitude) &&
      Number.isFinite(n.longitude) &&
      Math.abs(n.latitude) <= 90 &&
      Math.abs(n.longitude) <= 180,
  );
  const active = valid.find((n) => n.id === selected) || valid[0];
  if (!active && !userLocation)
    return <p className="live-notice">Koordinat node belum tersedia.</p>;
  return (
    <div className="live-map">
      <MapContainer
        center={userLocation ? [userLocation.latitude, userLocation.longitude] : [active!.latitude, active!.longitude]}
        zoom={13}
        className="h-full w-full"
      >
        {userLocation ? <LocationFocus point={userLocation} radiusKm={radiusKm} /> : <Focus node={active} nodes={valid} />}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {userLocation && <>
          <Circle center={[userLocation.latitude, userLocation.longitude]} radius={radiusKm * 1000} pathOptions={{ color: "#0b6fe5", weight: 1, dashArray: "5 7", fillOpacity: 0.04 }} interactive={false} />
          {userLocation.accuracy != null && <Circle center={[userLocation.latitude, userLocation.longitude]} radius={userLocation.accuracy} pathOptions={{ color: "#0b6fe5", weight: 1, fillOpacity: 0.1 }} interactive={false} />}
          <CircleMarker center={[userLocation.latitude, userLocation.longitude]} radius={7} pathOptions={{ color: "#fff", weight: 3, fillColor: "#076cfb", fillOpacity: 1 }}><Popup>{locationLabel}</Popup></CircleMarker>
        </>}
        {valid.map((n) => (
          <CircleMarker
            key={n.id}
            center={[n.latitude, n.longitude]}
            radius={n.id === selected ? 10 : 7}
            pathOptions={{
              color:
                ({calm:"#218160",warning:"#b87808",danger:"#c33f43"} as Record<string,string>)[sensorSummary(n).tone] || "#6c7f93",
              fillOpacity: 0.8,
            }}
            eventHandlers={{ click: () => onSelect(n.id) }}
          >
            <Popup minWidth={250} maxWidth={290} className="node-reading-popup">
              <strong className="node-popup-title">{n.name}</strong>
              <NodeStatus node={n} />
              <NodeReadings node={n} />
              <Link className="node-popup-detail" to={`/nodes/${encodeURIComponent(n.id)}`}>Lihat detail node <ArrowUpRight size={13} aria-hidden="true" /></Link>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

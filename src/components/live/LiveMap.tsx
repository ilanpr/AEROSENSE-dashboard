import { sensorSummary } from "@/lib/environment-presentation";
import { NodeStatus } from "./NodeStatus";
import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
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
export function LiveMap({
  nodes,
  selected,
  onSelect,
}: {
  nodes: LiveNode[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const valid = nodes.filter(
    (n) =>
      Number.isFinite(n.latitude) &&
      Number.isFinite(n.longitude) &&
      Math.abs(n.latitude) <= 90 &&
      Math.abs(n.longitude) <= 180,
  );
  const active = valid.find((n) => n.id === selected) || valid[0];
  if (!active)
    return <p className="live-notice">Koordinat node belum tersedia.</p>;
  return (
    <div className="live-map">
      <MapContainer
        center={[active.latitude, active.longitude]}
        zoom={13}
        className="h-full w-full"
      >
        <Focus node={active} nodes={valid} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
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
            <Popup>
              <strong>{n.name}</strong>
              <br />
              <NodeStatus node={n} />
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

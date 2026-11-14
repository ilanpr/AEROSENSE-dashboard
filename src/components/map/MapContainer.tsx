import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { type PrototypeNodeInfo } from "@/lib/mock-data";
import "leaflet/dist/leaflet.css";

interface SensorMapContainerProps {
  nodes: PrototypeNodeInfo[];
  selectedNodeName?: string;
  onSelectNode?: (name: string) => void;
  heightClassName?: string;
}

export function SensorMapContainer({
  nodes,
  selectedNodeName,
  onSelectNode,
  heightClassName = "h-[385px]",
}: SensorMapContainerProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div
        className={`w-full ${heightClassName} bg-[#eef7ff] rounded-2xl flex items-center justify-center text-xs text-[#7194b8] font-bold animate-pulse`}
      >
        Memuat peta...
      </div>
    );
  }

  return (
    <div
      className={`relative w-full ${heightClassName} rounded-[18px] overflow-hidden border border-[#dceef8] shadow-xs z-0`}
    >
      <MapContainer
        center={[-7.17, 112.59]}
        zoom={11}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles"
        />

        {nodes.map((node) => {
          const isSelected = node.name === selectedNodeName;
          const color = node.uiStatus === "baik" ? "#33c6a2" : "#f5bf42";

          return (
            <div key={node.code}>
              {isSelected && (
                <CircleMarker
                  center={[node.lat, node.lng]}
                  pathOptions={{
                    color: "#0f84ff",
                    fillColor: "#0f84ff",
                    fillOpacity: 0.25,
                    weight: 2,
                  }}
                  radius={14}
                />
              )}

              <CircleMarker
                center={[node.lat, node.lng]}
                pathOptions={{
                  color: "#ffffff",
                  fillColor: color,
                  fillOpacity: 0.95,
                  weight: isSelected ? 4 : 3,
                }}
                radius={isSelected ? 9 : 7.5}
                eventHandlers={{
                  click: () => onSelectNode?.(node.name),
                }}
              >
                <Popup>
                  <div className="p-1 text-center">
                    <strong className="block text-xs font-black text-[#11223D]">{node.name}</strong>
                    <span className="block text-[10px] text-[#687b95] my-0.5">
                      AQI {node.aqi} • {node.uiStatus === "baik" ? "Baik" : "Perlu perhatian"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectNode?.(node.name)}
                      className="mt-1 text-[9px] font-bold text-[#086cfb] hover:underline cursor-pointer"
                    >
                      Pilih node ini
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            </div>
          );
        })}
      </MapContainer>

      <div className="absolute right-3 bottom-3 z-400 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg shadow-sm border border-[#e5eef8] flex items-center gap-3 text-[9px] font-bold text-[#627787] pointer-events-none">
        <span className="flex items-center gap-1.5">
          <i className="w-2 h-2 rounded-full bg-[#33c6a2] inline-block" /> Baik
        </span>
        <span className="flex items-center gap-1.5">
          <i className="w-2 h-2 rounded-full bg-[#f5bf42] inline-block" /> Perlu perhatian
        </span>
      </div>

      <div className="absolute left-3 bottom-3 z-400 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded text-[8.5px] font-semibold text-[#617b8a] pointer-events-none">
        Peta kawasan Gresik & sekitarnya
      </div>
    </div>
  );
}

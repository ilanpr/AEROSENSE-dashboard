import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/constants";
import { GRESIK_NODES_DATA } from "@/lib/mock-data";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { ChevronRight } from "lucide-react";
import "leaflet/dist/leaflet.css";

export function MiniMap() {
  const [isMounted, setIsMounted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <article className="bg-white border border-[#e5eef8] rounded-[20px] shadow-sm p-5 flex flex-col">
      <div className="flex justify-between items-center gap-4 mb-3.5">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[1.6px] text-[#6fa0ca] mb-1">
            PANTAU LOKASI
          </p>
          <h2 className="text-base font-black text-[#11223D]">Peta sensor</h2>
          <p className="text-[10px] text-[#8c9db1] mt-0.5">
            Titik pemantauan kawasan Gresik dan sekitarnya
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate(ROUTES.SENSOR_MAP)}
          className="text-[#086df0] text-[10px] font-extrabold flex items-center gap-1 hover:underline cursor-pointer shrink-0"
        >
          Lihat semua node <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="rounded-[14px] overflow-hidden h-[295px] relative z-0 border border-[#dceef8]">
        {!isMounted ? (
          <div className="w-full h-full bg-[#eef7ff] animate-pulse" />
        ) : (
          <MapContainer
            center={[-7.17, 112.59]}
            zoom={11}
            className="w-full h-full"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              className="map-tiles"
            />
            {GRESIK_NODES_DATA.map((node) => {
              const color = node.uiStatus === "baik" ? "#33c6a2" : "#f5bf42";

              return (
                <CircleMarker
                  key={node.code}
                  center={[node.lat, node.lng]}
                  pathOptions={{
                    color: "#ffffff",
                    fillColor: color,
                    fillOpacity: 0.9,
                    weight: 3,
                  }}
                  radius={7}
                >
                  <Popup>
                    <div className="p-1 text-center">
                      <strong className="block text-xs font-black text-[#11223D]">
                        {node.name}
                      </strong>
                      <span className="block text-[10px] text-[#687b95]">
                        AQI {node.aqi} • {node.uiStatus === "baik" ? "Baik" : "Perlu perhatian"}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`${ROUTES.SENSOR_MAP}?node=${encodeURIComponent(node.name)}`)
                        }
                        className="mt-1 text-[9px] font-bold text-[#086cfb] hover:underline cursor-pointer"
                      >
                        Detail &rarr;
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        )}

        <div className="absolute right-2.5 bottom-2.5 z-400 bg-white/95 backdrop-blur-xs px-2.5 py-1.5 rounded-lg shadow-sm border border-[#e5eef8] flex items-center gap-2.5 text-[8.5px] font-bold text-[#627787] pointer-events-none">
          <span className="flex items-center gap-1">
            <i className="w-2 h-2 rounded-full bg-[#33c6a2] inline-block" /> Baik
          </span>
          <span className="flex items-center gap-1">
            <i className="w-2 h-2 rounded-full bg-[#f5bf42] inline-block" /> Perlu perhatian
          </span>
        </div>

        <div className="absolute left-2.5 bottom-2.5 z-400 bg-white/90 backdrop-blur-xs px-2 py-1 rounded text-[8.5px] font-semibold text-[#617b8a] pointer-events-none">
          10 titik sensor terhubung
        </div>
      </div>
    </article>
  );
}

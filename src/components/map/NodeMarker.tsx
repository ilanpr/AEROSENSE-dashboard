import { CircleMarker, Popup } from "react-leaflet";
import { Badge } from "@/components/ui/badge";

export interface NodeData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: "online" | "offline" | "warning" | "critical";
  readings: {
    aqi: number;
    pm25: number;
    tvoc: number;
    eco2: number;
  };
  lastUpdate: string;
}

interface NodeMarkerProps {
  node: NodeData;
  activeLayer: "aqi" | "pm25" | "tvoc" | "eco2" | "heatmap";
}

export function NodeMarker({ node, activeLayer }: NodeMarkerProps) {
  // Determine color based on status or activeLayer value
  let color = "#22c55e"; // green
  if (node.status === "warning") color = "#eab308"; // yellow
  if (node.status === "critical") color = "#ef4444"; // red
  if (node.status === "offline") color = "#94a3b8"; // slate

  let displayValue = node.readings.aqi;
  let unit = "AQI";

  if (activeLayer === "pm25") {
    displayValue = node.readings.pm25;
    unit = "µg/m³";
  } else if (activeLayer === "tvoc") {
    displayValue = node.readings.tvoc;
    unit = "ppb";
  } else if (activeLayer === "eco2") {
    displayValue = node.readings.eco2;
    unit = "ppm";
  }

  return (
    <CircleMarker
      center={[node.lat, node.lng]}
      pathOptions={{ color, fillColor: color, fillOpacity: 0.7 }}
      radius={10}
    >
      <Popup className="rounded-xl" closeButton={false}>
        <div className="p-1 min-w-[180px]">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-bold text-sm text-foreground m-0">{node.name}</h4>
            <Badge
              variant="outline"
              className={`text-[10px] px-1 py-0 h-4 border-transparent text-white ${
                node.status === "online"
                  ? "bg-green-500"
                  : node.status === "warning"
                    ? "bg-yellow-500"
                    : node.status === "critical"
                      ? "bg-red-500"
                      : "bg-slate-500"
              }`}
            >
              {node.status}
            </Badge>
          </div>

          <div className="flex items-end gap-1 mb-2 border-b border-border/50 pb-2">
            <span className="text-2xl font-bold leading-none">{displayValue}</span>
            <span className="text-xs text-muted-foreground">{unit}</span>
          </div>

          <div className="text-[10px] text-muted-foreground flex justify-between">
            <span>Lat: {node.lat.toFixed(4)}</span>
            <span>Lng: {node.lng.toFixed(4)}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 italic">
            Update: {node.lastUpdate}
          </div>
        </div>
      </Popup>
    </CircleMarker>
  );
}

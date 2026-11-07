import { Card } from "@/components/ui/card";
import { Layers } from "lucide-react";

export type MapLayer = "aqi" | "pm25" | "tvoc" | "eco2" | "heatmap";

interface LayerSwitcherProps {
  activeLayer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
}

export function LayerSwitcher({ activeLayer, onLayerChange }: LayerSwitcherProps) {
  const layers: { id: MapLayer; label: string }[] = [
    { id: "aqi", label: "AQI (Indeks)" },
    { id: "pm25", label: "PM2.5" },
    { id: "tvoc", label: "TVOC" },
    { id: "eco2", label: "eCO₂" },
    { id: "heatmap", label: "Heatmap" },
  ];

  return (
    <Card className="absolute top-4 right-4 z-[400] w-48 bg-white/90 backdrop-blur-md shadow-lg border-border/50">
      <div className="p-3 border-b border-border/50 flex items-center gap-2">
        <Layers className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Lapisan Data</span>
      </div>
      <div className="p-2 flex flex-col gap-1">
        {layers.map((layer) => (
          <button
            key={layer.id}
            onClick={() => onLayerChange(layer.id)}
            className={`text-left px-3 py-2 text-sm rounded-md transition-colors ${
              activeLayer === layer.id
                ? "bg-primary-100 text-primary-700 font-semibold"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            }`}
          >
            {layer.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

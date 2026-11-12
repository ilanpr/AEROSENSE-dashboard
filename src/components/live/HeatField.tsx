import { useEffect, useRef, useState } from "react";
import { ImageOverlay, useMap } from "react-leaflet";
import { apiRequest } from "@/services/api";

// Continuous heatmap of model values (Open-Meteo) for the visible map area, like a weather map.
// Values come from /v1/heatmap as a small grid and are smoothed in the browser with bilinear interpolation.
type Stop = [number, string];
export const HEAT_LAYERS = {
  temperature: {
    label: "Suhu",
    unit: "°C",
    stops: [[20, "#4fa3f7"], [24, "#9be15d"], [27, "#f6d743"], [30, "#f59e0b"], [33, "#ea580c"], [36, "#b91c1c"]] as Stop[],
  },
  pm25: {
    label: "PM2.5",
    unit: "µg/m³",
    stops: [[0, "#22c55e"], [15, "#a3e635"], [35, "#facc15"], [55, "#f97316"], [150, "#dc2626"], [250, "#7e22ce"]] as Stop[],
  },
  aqi: {
    label: "AQI",
    unit: "AQI US",
    stops: [[0, "#22c55e"], [50, "#facc15"], [100, "#f97316"], [150, "#ef4444"], [200, "#8b5cf6"], [300, "#7f1d1d"]] as Stop[],
  },
} as const;
export type HeatLayerKey = keyof typeof HEAT_LAYERS;
type Grid = {
  south: number;
  west: number;
  step: number;
  rows: number;
  cols: number;
  values: (number | null)[][];
  source: string;
  valid_at: string | null;
};
export type HeatInfo = { source: string; valid_at: string | null; error?: string } | null;

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
function colorAt(stops: readonly Stop[], v: number) {
  if (v <= stops[0][0]) return hex(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    const [b, cb] = stops[i];
    if (v <= b) {
      const [a, ca] = stops[i - 1];
      const t = (v - a) / (b - a),
        x = hex(ca),
        y = hex(cb);
      return x.map((k, j) => Math.round(k + (y[j] - k) * t));
    }
  }
  return hex(stops[stops.length - 1][1]);
}

// Bilinear interpolation over the grid, drawn to a canvas. Missing grid points stay transparent.
function render(g: Grid, stops: readonly Stop[]) {
  const W = (g.cols - 1) * 24 + 1,
    H = (g.rows - 1) * 24 + 1;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const gy = ((H - 1 - y) / (H - 1)) * (g.rows - 1); // row 0 is the south edge
    const i0 = Math.min(Math.floor(gy), g.rows - 2),
      ty = gy - i0;
    for (let x = 0; x < W; x++) {
      const gx = (x / (W - 1)) * (g.cols - 1);
      const j0 = Math.min(Math.floor(gx), g.cols - 2),
        tx = gx - j0;
      const q = [g.values[i0][j0], g.values[i0][j0 + 1], g.values[i0 + 1][j0], g.values[i0 + 1][j0 + 1]];
      if (q.some((v) => v == null)) continue;
      const [a, b, c, d] = q as number[];
      const v = a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
      const [r, gr, bl] = colorAt(stops, v);
      const o = (y * W + x) * 4;
      img.data[o] = r;
      img.data[o + 1] = gr;
      img.data[o + 2] = bl;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

export function HeatField({ layer, onInfo }: { layer: HeatLayerKey; onInfo: (i: HeatInfo) => void }) {
  const map = useMap();
  const [overlay, setOverlay] = useState<{ url: string; bounds: [[number, number], [number, number]] } | null>(
    null,
  );
  const info = useRef(onInfo);
  info.current = onInfo;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let abort: AbortController | null = null;
    const load = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        abort?.abort();
        abort = new AbortController();
        const b = map.getBounds().pad(0.15);
        const qs = new URLSearchParams({
          layer,
          south: b.getSouth().toFixed(3),
          west: b.getWest().toFixed(3),
          north: b.getNorth().toFixed(3),
          east: b.getEast().toFixed(3),
        });
        try {
          const g = await apiRequest<Grid>("/v1/heatmap?" + qs, { signal: abort.signal }, false);
          if (g.rows < 2 || g.cols < 2) return;
          setOverlay({
            url: render(g, HEAT_LAYERS[layer].stops),
            bounds: [
              [g.south, g.west],
              [g.south + (g.rows - 1) * g.step, g.west + (g.cols - 1) * g.step],
            ],
          });
          info.current({ source: g.source, valid_at: g.valid_at });
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
          setOverlay(null);
          info.current({ source: "", valid_at: null, error: e instanceof Error ? e.message : "Heatmap belum tersedia." });
        }
      }, 350);
    };
    load();
    map.on("moveend", load);
    return () => {
      clearTimeout(timer);
      abort?.abort();
      map.off("moveend", load);
    };
  }, [map, layer]);
  return overlay ? (
    <ImageOverlay key={overlay.url.length + overlay.bounds.join()} url={overlay.url} bounds={overlay.bounds}
      opacity={0.55} interactive={false} zIndex={2} />
  ) : null;
}

export function HeatLegend({ layer, info }: { layer: HeatLayerKey; info: HeatInfo }) {
  const l = HEAT_LAYERS[layer];
  const first = l.stops[0][0],
    last = l.stops[l.stops.length - 1][0];
  const gradient = l.stops.map(([v, c]) => `${c} ${((v - first) / (last - first)) * 100}%`).join(", ");
  const time = info?.valid_at
    ? new Date(info.valid_at).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }) + " WIB"
    : "";
  return (
    <div className="heat-legend">
      <div className="heat-scale" style={{ background: `linear-gradient(90deg, ${gradient})` }} />
      <div className="heat-ticks">
        {l.stops.map(([v]) => (
          <span key={v}>{v}</span>
        ))}
      </div>
      <p>
        {info?.error
          ? info.error
          : `${l.label} (${l.unit}) · ${info?.source || "memuat…"}${time ? " · " + time : ""}. Estimasi model, bukan sensor.`}
      </p>
    </div>
  );
}

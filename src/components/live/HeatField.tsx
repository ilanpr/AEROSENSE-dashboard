import { useEffect, useMemo, useRef, useState } from "react";
import { ImageOverlay, Marker, useMap } from "react-leaflet";
import { divIcon } from "leaflet";
import { apiRequest } from "@/services/api";

// Continuous heatmap of model values (Open-Meteo) for the visible map area, like a weather map.
// /v1/heatmap returns a small grid; the browser smooths it with bicubic (Catmull-Rom) interpolation,
// blends it with the map (multiply, so streets and names stay readable) and labels a few grid points.
type Stop = [number, string];
export const HEAT_LAYERS = {
  temperature: {
    label: "Suhu",
    unit: "°C",
    format: (v: number) => `${Math.round(v)}°`,
    stops: [
      [18, "#2f7fd8"],
      [22, "#3fb0c6"],
      [25, "#7fcf7a"],
      [27, "#e9d84f"],
      [29, "#f6a83b"],
      [31, "#ef7a2f"],
      [33, "#e0512b"],
      [36, "#b52a2a"],
    ] as Stop[],
  },
  pm25: {
    label: "PM2.5",
    unit: "µg/m³",
    format: (v: number) => String(Math.round(v)),
    stops: [
      [0, "#3fae6a"],
      [15.5, "#a8cf4f"],
      [35, "#f0d24a"],
      [55.4, "#f39a3a"],
      [100, "#e2533a"],
      [150.4, "#b8323f"],
      [250, "#7b2c74"],
    ] as Stop[],
  },
  aqi: {
    label: "AQI",
    unit: "AQI US",
    format: (v: number) => String(Math.round(v)),
    stops: [
      [0, "#3fae6a"],
      [50, "#e9d84f"],
      [100, "#f39a3a"],
      [150, "#e2533a"],
      [200, "#9b3a8c"],
      [300, "#6e2240"],
    ] as Stop[],
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

// Missing grid points take the mean of the grid so the surface has no holes.
function filled(g: Grid) {
  const known = g.values.flat().filter((v): v is number => typeof v === "number");
  const mean = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 0;
  return g.values.map((row) => row.map((v) => (typeof v === "number" ? v : mean)));
}
const cr = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));

// Bicubic interpolation of the grid onto a canvas. Row 0 of the grid is the south edge.
function render(g: Grid, v: number[][], stops: readonly Stop[]) {
  const S = 32;
  const W = (g.cols - 1) * S + 1,
    H = (g.rows - 1) * S + 1;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const at = (i: number, j: number) =>
    v[Math.min(g.rows - 1, Math.max(0, i))][Math.min(g.cols - 1, Math.max(0, j))];
  const lo = stops[0][0],
    hi = stops[stops.length - 1][0];
  for (let y = 0; y < H; y++) {
    const gy = ((H - 1 - y) / (H - 1)) * (g.rows - 1);
    const i = Math.min(Math.floor(gy), g.rows - 2),
      ty = gy - i;
    for (let x = 0; x < W; x++) {
      const gx = (x / (W - 1)) * (g.cols - 1);
      const j = Math.min(Math.floor(gx), g.cols - 2),
        tx = gx - j;
      const rowAt = (r: number) => cr(at(r, j - 1), at(r, j), at(r, j + 1), at(r, j + 2), tx);
      const value = cr(rowAt(i - 1), rowAt(i), rowAt(i + 1), rowAt(i + 2), ty);
      const [r, gr, b] = colorAt(stops, Math.min(hi, Math.max(lo, value)));
      const o = (y * W + x) * 4;
      img.data[o] = r;
      img.data[o + 1] = gr;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

// Value of the smooth surface at a coordinate; null outside the grid.
function sample(g: Grid, v: number[][], lat: number, lng: number) {
  const gy = (lat - g.south) / g.step,
    gx = (lng - g.west) / g.step;
  if (gy < 0 || gx < 0 || gy > g.rows - 1 || gx > g.cols - 1) return null;
  const at = (i: number, j: number) =>
    v[Math.min(g.rows - 1, Math.max(0, i))][Math.min(g.cols - 1, Math.max(0, j))];
  const i = Math.min(Math.floor(gy), g.rows - 2),
    j = Math.min(Math.floor(gx), g.cols - 2);
  const rowAt = (r: number) => cr(at(r, j - 1), at(r, j), at(r, j + 1), at(r, j + 2), gx - j);
  return cr(rowAt(i - 1), rowAt(i), rowAt(i + 1), rowAt(i + 2), gy - i);
}

type Overlay = {
  url: string;
  bounds: [[number, number], [number, number]];
  labels: { key: string; position: [number, number]; text: string }[];
};

export function HeatField({
  layer,
  onInfo,
}: {
  layer: HeatLayerKey;
  onInfo: (i: HeatInfo) => void;
}) {
  const map = useMap();
  const [overlay, setOverlay] = useState<Overlay | null>(null);
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
          const v = filled(g);
          // Labels spread evenly over the view (3 rows x 4 columns), read from the same smooth surface.
          const view = map.getBounds();
          const labels: Overlay["labels"] = [];
          for (const fy of [1 / 6, 1 / 2, 5 / 6])
            for (const fx of [1 / 8, 3 / 8, 5 / 8, 7 / 8]) {
              const lat = view.getSouth() + (view.getNorth() - view.getSouth()) * fy;
              const lng = view.getWest() + (view.getEast() - view.getWest()) * fx;
              // The legend and layer buttons sit in the bottom-left corner.
              if (fy < 0.5 && fx < 0.3) continue;
              const value = sample(g, v, lat, lng);
              if (value != null)
                labels.push({
                  key: `${fy}-${fx}`,
                  position: [lat, lng],
                  text: HEAT_LAYERS[layer].format(value),
                });
            }
          setOverlay({
            url: render(g, v, HEAT_LAYERS[layer].stops),
            bounds: [
              [g.south, g.west],
              [g.south + (g.rows - 1) * g.step, g.west + (g.cols - 1) * g.step],
            ],
            labels,
          });
          info.current({ source: g.source, valid_at: g.valid_at });
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
          setOverlay(null);
          info.current({
            source: "",
            valid_at: null,
            error: e instanceof Error ? e.message : "Heatmap belum tersedia.",
          });
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
  const icons = useMemo(
    () =>
      new Map(
        (overlay?.labels || []).map((l) => [
          l.key,
          divIcon({ className: "heat-label", html: `<span>${l.text}</span>`, iconSize: [0, 0] }),
        ]),
      ),
    [overlay],
  );
  if (!overlay) return null;
  return (
    <>
      <ImageOverlay
        key={overlay.url.length + overlay.bounds.join()}
        url={overlay.url}
        bounds={overlay.bounds}
        opacity={0.78}
        interactive={false}
        zIndex={2}
        className="heat-overlay"
      />
      {overlay.labels.map((l) => (
        <Marker
          key={l.key}
          position={l.position}
          icon={icons.get(l.key)!}
          interactive={false}
          keyboard={false}
          zIndexOffset={-1000}
        />
      ))}
    </>
  );
}

export function HeatLegend({ layer, info }: { layer: HeatLayerKey; info: HeatInfo }) {
  const l = HEAT_LAYERS[layer];
  const first = l.stops[0][0],
    last = l.stops[l.stops.length - 1][0];
  const gradient = l.stops
    .map(([v, c]) => `${c} ${((v - first) / (last - first)) * 100}%`)
    .join(", ");
  const ticks = [l.stops[0], l.stops[Math.floor(l.stops.length / 2)], l.stops[l.stops.length - 1]];
  const time = info?.valid_at
    ? new Date(info.valid_at).toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB"
    : "";
  return (
    <div className="heat-legend">
      <div className="heat-legend-head">
        <strong>{l.label}</strong>
        <span>{l.unit}</span>
      </div>
      <div className="heat-scale" style={{ background: `linear-gradient(90deg, ${gradient})` }} />
      <div className="heat-ticks">
        {ticks.map(([v]) => (
          <span key={v}>{l.format(v)}</span>
        ))}
      </div>
      <p>
        {info?.error
          ? info.error
          : `${info?.source || "Memuat…"}${time ? " · " + time : ""}. Estimasi model, bukan sensor.`}
      </p>
    </div>
  );
}

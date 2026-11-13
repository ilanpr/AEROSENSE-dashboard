import { useEffect, useMemo, useRef, useState } from "react";
import { ImageOverlay, Marker, useMap } from "react-leaflet";
import { divIcon } from "leaflet";
import { apiRequest } from "@/services/api";
import { ID_CITIES } from "@/lib/id-cities";

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
  rain: {
    label: "Hujan",
    unit: "mm/jam",
    format: (v: number) => (v < 0.1 ? "0" : String(Math.round(v * 10) / 10).replace(".", ",")),
    // White multiplies to nothing on the base map, so dry areas stay clear.
    quiet: 0.1,
    stops: [
      [0, "#ffffff"],
      [0.5, "#c9e6ff"],
      [2, "#7cc0f5"],
      [5, "#3a8be0"],
      [10, "#2f56c9"],
      [20, "#7a3fc4"],
      [40, "#c2338f"],
    ] as Stop[],
  },
  cloud: {
    label: "Awan",
    unit: "% tutupan",
    format: (v: number) => `${Math.round(v)}%`,
    stops: [
      [0, "#ffffff"],
      [30, "#e7ecf3"],
      [60, "#c4ccd9"],
      [85, "#9aa5b7"],
      [100, "#7b8698"],
    ] as Stop[],
  },
  thunder: {
    label: "Potensi petir",
    unit: "CAPE J/kg",
    format: (v: number) => String(Math.round(v / 100) * 100),
    quiet: 300,
    stops: [
      [0, "#ffffff"],
      [500, "#fff2bf"],
      [1000, "#f7d454"],
      [2000, "#f39a3a"],
      [3000, "#e2533a"],
      [4500, "#a8326e"],
    ] as Stop[],
  },
  wind: {
    label: "Angin",
    unit: "km/jam",
    format: (v: number) => String(Math.round(v)),
    stops: [
      [0, "#7fb3d9"],
      [5, "#5aa0d6"],
      [10, "#4f8fd0"],
      [15, "#4fb39a"],
      [20, "#9ac94a"],
      [30, "#e8c23d"],
      [40, "#ea8b37"],
      [55, "#d9483a"],
      [70, "#a8326e"],
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
  /** Wind only: direction the wind comes from, degrees. */
  direction?: (number | null)[][];
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
      // Feather the outer edge so the field fades into the map instead of ending in a hard box.
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y) / (Math.min(W, H) * 0.12);
      img.data[o + 3] = Math.round(255 * Math.min(1, edge));
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

type Layer = { id: number; url: string; bounds: [[number, number], [number, number]] };
type Field = {
  g: Grid;
  v: number[][];
  zoom: number;
  covers: [[number, number], [number, number]];
  /** Wind only: flow components in km/h, u towards east, v towards north. */
  uv?: { u: number[][]; v: number[][] };
};

// Speed and "from" direction to the components of the flow (towards), used by labels and particles.
function windComponents(g: Grid, speed: number[][]) {
  const u: number[][] = [],
    v: number[][] = [];
  for (let i = 0; i < g.rows; i++) {
    u.push([]);
    v.push([]);
    for (let j = 0; j < g.cols; j++) {
      const d = g.direction?.[i]?.[j];
      const rad = ((typeof d === "number" ? d : 0) * Math.PI) / 180;
      const sp = typeof d === "number" ? speed[i][j] : 0;
      u[i].push(-sp * Math.sin(rad));
      v[i].push(-sp * Math.cos(rad));
    }
  }
  return { u, v };
}
const ARROWS = ["→", "↗", "↑", "↖", "←", "↙", "↓", "↘"];
const arrow = (u: number, v: number) =>
  ARROWS[((Math.round(Math.atan2(v, u) / (Math.PI / 4)) % 8) + 8) % 8];

// Particles drawn on a canvas over the map, carried by the wind field like a weather map.
// Paused while the map moves; off when the viewer asks for reduced motion.
function WindParticles({ field }: { field: Field }) {
  const map = useMap();
  useEffect(() => {
    const uv = field.uv;
    if (!uv || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = document.createElement("canvas");
    canvas.className = "wind-canvas";
    map.getContainer().appendChild(canvas);
    const ctx = canvas.getContext("2d")!;
    const CELL = 8,
      SPEED = 0.12, // pixels per frame for each km/h
      LIFE = 90;
    let raf = 0,
      W = 0,
      H = 0,
      cw = 0,
      ch = 0;
    let cells = new Float32Array(0),
      px = new Float32Array(0),
      py = new Float32Array(0),
      age = new Uint16Array(0);
    // Flow sampled on a coarse screen grid once per view, so each frame is a cheap lookup.
    const build = () => {
      const size = map.getSize();
      W = size.x;
      H = size.y;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cw = Math.ceil(W / CELL) + 1;
      ch = Math.ceil(H / CELL) + 1;
      cells = new Float32Array(cw * ch * 2);
      for (let y = 0; y < ch; y++)
        for (let x = 0; x < cw; x++) {
          const ll = map.containerPointToLatLng([x * CELL, y * CELL]);
          const u = sample(field.g, uv.u, ll.lat, ll.lng),
            v = sample(field.g, uv.v, ll.lat, ll.lng);
          const k = (y * cw + x) * 2;
          cells[k] = u ?? NaN;
          cells[k + 1] = v ?? NaN;
        }
      const n = Math.min(1800, Math.round((W * H) / 900));
      px = new Float32Array(n);
      py = new Float32Array(n);
      age = new Uint16Array(n);
      for (let i = 0; i < n; i++) reset(i);
    };
    const reset = (i: number) => {
      px[i] = Math.random() * W;
      py[i] = Math.random() * H;
      age[i] = Math.floor(Math.random() * LIFE);
    };
    const frame = () => {
      // Fade the previous frame to leave short trails.
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = "rgba(0,0,0,0.9)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let i = 0; i < px.length; i++) {
        const cx = Math.round(px[i] / CELL),
          cy = Math.round(py[i] / CELL);
        if (++age[i] > LIFE || cx < 0 || cy < 0 || cx >= cw || cy >= ch) {
          reset(i);
          continue;
        }
        const k = (cy * cw + cx) * 2,
          u = cells[k],
          v = cells[k + 1];
        if (!Number.isFinite(u) || !Number.isFinite(v)) {
          reset(i);
          continue;
        }
        const nx = px[i] + u * SPEED,
          ny = py[i] - v * SPEED;
        ctx.moveTo(px[i], py[i]);
        ctx.lineTo(nx, ny);
        px[i] = nx;
        py[i] = ny;
      }
      ctx.stroke();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, W, H);
    };
    const start = () => {
      stop();
      build();
      raf = requestAnimationFrame(frame);
    };
    start();
    map.on("movestart zoomstart", stop);
    map.on("moveend resize", start);
    return () => {
      stop();
      map.off("movestart zoomstart", stop);
      map.off("moveend resize", start);
      canvas.remove();
    };
  }, [map, field]);
  return null;
}

type Label = {
  key: string;
  position: [number, number];
  text: string;
  city: boolean;
  /** Background from the colour scale at this value, and a readable text colour on it. */
  bg: string;
  fg: string;
};
// At this zoom and below, labels follow cities instead of a coordinate lattice.
const CITY_ZOOM = 10;
// The heatmap covers Indonesia and its seas; views beyond it are clipped to this box.
const REGION = { south: -13, west: 92, north: 8, east: 143 };
const clip = (b: {
  getSouth(): number;
  getWest(): number;
  getNorth(): number;
  getEast(): number;
}) => {
  const s = Math.max(REGION.south, b.getSouth()),
    w = Math.max(REGION.west, b.getWest()),
    n = Math.min(REGION.north, b.getNorth()),
    e = Math.min(REGION.east, b.getEast());
  return s < n && w < e ? { s, w, n, e } : null;
};

// Label spacing in degrees: a round step giving about three rows of labels in the view.
const STEPS = [0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5];
const labelStep = (latSpan: number) => STEPS.find((s) => s >= latSpan / 3) ?? 5;

export function HeatField({
  layer,
  onInfo,
}: {
  layer: HeatLayerKey;
  onInfo: (i: HeatInfo) => void;
}) {
  const map = useMap();
  const [layers, setLayers] = useState<Layer[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const field = useRef<Field | null>(null);
  const [wind, setWind] = useState<Field | null>(null);
  const info = useRef(onInfo);
  info.current = onInfo;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let abort: AbortController | null = null;
    let seq = 0;
    field.current = null;
    setWind(null);
    setLayers([]);
    setLabels([]);
    // Labels sit on fixed coordinates (multiples of a round step), so they move with the map;
    // their values are read from the current surface.
    const relabel = () => {
      const f = field.current;
      if (!f) return setLabels([]);
      const view = map.getBounds();
      const size = map.getSize();
      const zoom = map.getZoom();
      // Zoomed out: one label per city, under its name; bigger cities first as the view widens.
      // Zoomed in: labels on fixed coordinates that move with the map.
      const points: { lat: number; lng: number; city: boolean }[] = [];
      if (zoom <= CITY_ZOOM) {
        // Whole country: provincial capitals; a few islands: large cities too; a province: all towns.
        const maxRank = zoom <= 5 ? 1 : zoom <= 7 ? 2 : 3;
        for (const [, lat, lng, rank] of [...ID_CITIES].sort((x, y) => x[3] - y[3]))
          if (rank <= maxRank && view.contains([lat, lng])) points.push({ lat, lng, city: true });
      } else {
        const step = labelStep(view.getNorth() - view.getSouth());
        for (
          let lat = Math.ceil(view.getSouth() / step) * step;
          lat <= view.getNorth();
          lat += step
        )
          for (
            let lng = Math.ceil(view.getWest() / step) * step;
            lng <= view.getEast();
            lng += step
          )
            points.push({ lat, lng, city: false });
      }
      const out: Label[] = [];
      const placed: { x: number; y: number }[] = [];
      for (const { lat, lng, city } of points) {
        const p = map.latLngToContainerPoint([lat, lng]);
        // Keep clear of the edges, of the legend in the bottom-left corner, and of other labels.
        if (p.x < 24 || p.y < 24 || p.x > size.x - 24 || p.y > size.y - 24) continue;
        if (p.x < 260 && p.y > size.y - 200) continue;
        if (placed.some((q) => Math.abs(q.x - p.x) < 64 && Math.abs(q.y - p.y) < 34)) continue;
        const value = sample(f.g, f.v, lat, lng);
        if (value == null) continue;
        // Rain and lightning labels only where there is something to report.
        const quiet = (HEAT_LAYERS[layer] as { quiet?: number }).quiet;
        if (quiet !== undefined && value < quiet) continue;
        let text = HEAT_LAYERS[layer].format(value);
        if (f.uv) {
          const u = sample(f.g, f.uv.u, lat, lng) ?? 0,
            v = sample(f.g, f.uv.v, lat, lng) ?? 0;
          if (Math.hypot(u, v) >= 1) text += " " + arrow(u, v);
        }
        // Like a weather map: the label takes the colour of its value, with text readable on it.
        const stops = HEAT_LAYERS[layer].stops;
        const [r, gr, bl] = colorAt(
          stops,
          Math.min(stops[stops.length - 1][0], Math.max(stops[0][0], value)),
        );
        const light = (0.299 * r + 0.587 * gr + 0.114 * bl) / 255 > 0.62;
        placed.push(p);
        out.push({
          key: `${city ? "c" : "g"}${lat.toFixed(3)},${lng.toFixed(3)}`,
          position: [lat, lng],
          text,
          city,
          bg: `rgb(${r} ${gr} ${bl})`,
          fg: light ? "#1d2f43" : "#fff",
        });
        if (out.length >= 40) break;
      }
      setLabels(out);
    };
    // Fetch only when the view leaves the area already loaded or the zoom changed a lot.
    const needsData = () => {
      const f = field.current;
      if (!f) return true;
      const v = clip(map.getBounds());
      if (!v) return false;
      const [[s, w], [n, e]] = f.covers;
      return (
        v.s < s - 1e-6 ||
        v.w < w - 1e-6 ||
        v.n > n + 1e-6 ||
        v.e > e + 1e-6 ||
        Math.abs(map.getZoom() - f.zoom) >= 2
      );
    };
    const load = () => {
      relabel();
      if (!needsData()) return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        abort?.abort();
        abort = new AbortController();
        const id = ++seq;
        const b = clip(map.getBounds().pad(0.6));
        if (!b) return;
        const qs = new URLSearchParams({
          layer,
          south: b.s.toFixed(3),
          west: b.w.toFixed(3),
          north: b.n.toFixed(3),
          east: b.e.toFixed(3),
        });
        try {
          const g = await apiRequest<Grid>("/v1/heatmap?" + qs, { signal: abort.signal }, false);
          if (g.rows < 2 || g.cols < 2 || id !== seq) return;
          const v = filled(g);
          const bounds: Layer["bounds"] = [
            [g.south, g.west],
            [g.south + (g.rows - 1) * g.step, g.west + (g.cols - 1) * g.step],
          ];
          field.current = {
            g,
            v,
            zoom: map.getZoom(),
            covers: bounds,
            ...(g.direction ? { uv: windComponents(g, v) } : {}),
          };
          setWind(field.current.uv ? field.current : null);
          // New image fades in over the old one; the old one is removed once it is covered.
          setLayers((old) => [
            ...old.slice(-1),
            { id, url: render(g, v, HEAT_LAYERS[layer].stops), bounds },
          ]);
          setTimeout(() => setLayers((old) => old.filter((l) => l.id >= id)), 700);
          relabel();
          info.current({ source: g.source, valid_at: g.valid_at });
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
          info.current({
            source: "",
            valid_at: null,
            error: e instanceof Error ? e.message : "Heatmap belum tersedia.",
          });
        }
      }, 300);
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
        labels.map((l) => [
          l.key,
          divIcon({
            className: l.city ? "heat-label heat-label-city" : "heat-label",
            html: `<span style="background:${l.bg};color:${l.fg}">${l.text}</span>`,
            iconSize: [0, 0],
          }),
        ]),
      ),
    [labels],
  );
  return (
    <>
      {wind && <WindParticles field={wind} />}
      {layers.map((l) => (
        <ImageOverlay
          key={l.id}
          url={l.url}
          bounds={l.bounds}
          interactive={false}
          pane="heatPane"
          className="heat-overlay"
        />
      ))}
      {labels.map((l) => (
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

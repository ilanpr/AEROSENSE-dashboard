// Map heatmap: a grid of model values (Open-Meteo) over the visible map area. Public, no account needed.
// The grid is snapped to its step so nearby views share one cached request.
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

export const LAYERS = {
  temperature: {
    url: "https://api.open-meteo.com/v1/forecast",
    field: "temperature_2m",
    unit: "°C",
    source: "Open-Meteo (model cuaca)",
    minStep: 0.1, // ICON/GFS around 0.1°
  },
  pm25: {
    url: "https://air-quality-api.open-meteo.com/v1/air-quality",
    field: "pm2_5",
    unit: "µg/m³",
    source: "Open-Meteo / CAMS (model kualitas udara)",
    minStep: 0.2, // CAMS is coarser; a finer grid only repeats values
  },
  aqi: {
    url: "https://air-quality-api.open-meteo.com/v1/air-quality",
    field: "us_aqi",
    unit: "AQI US",
    source: "Open-Meteo / CAMS (model kualitas udara)",
    minStep: 0.2,
  },
};

const MAX_POINTS = 16; // per axis, so at most 256 locations per request
const MAX_SPAN = 24; // degrees; wider views are refused instead of fetching a coarse grid

// Snap the view to a grid. Returns the grid origin, step and size, or throws on a bad view.
export function heatGrid(south, west, north, east, minStep = 0.1) {
  if (![south, west, north, east].every(Number.isFinite)) throw fail("Area peta tidak valid.");
  if (south >= north || west >= east || Math.abs(south) > 85 || Math.abs(north) > 85)
    throw fail("Area peta tidak valid.");
  const span = Math.max(north - south, east - west);
  if (span > MAX_SPAN) throw fail("Perbesar peta untuk melihat heatmap.");
  const step = Math.max(minStep, Math.ceil((span / (MAX_POINTS - 2)) * 20) / 20);
  const s = Math.floor(south / step) * step,
    w = Math.floor(west / step) * step;
  const rows = Math.min(MAX_POINTS, Math.ceil((north - s) / step) + 1);
  const cols = Math.min(MAX_POINTS, Math.ceil((east - w) / step) + 1);
  const r = (v) => Math.round(v * 1000) / 1000;
  return { south: r(s), west: r(w), step: r(step), rows, cols };
}

export function heatmapRoutes({ send, rate, request, now = Date.now }) {
  const cache = new Map();
  return async (req, res, url) => {
    if (url.pathname !== "/v1/heatmap" || req.method !== "GET") return false;
    const layer = LAYERS[url.searchParams.get("layer")];
    if (!layer) throw fail("Lapisan heatmap tidak dikenal.");
    const q = (k) => Number(url.searchParams.get(k));
    const g = heatGrid(q("south"), q("west"), q("north"), q("east"), layer.minStep);
    const key = [url.searchParams.get("layer"), g.south, g.west, g.step, g.rows, g.cols].join(":");
    const hit = cache.get(key);
    if (hit && hit.until > now()) return send(res, 200, hit.body), true;
    const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0];
    rate("heat:" + ip, 30);
    const lats = [],
      lons = [];
    for (let i = 0; i < g.rows; i++)
      for (let j = 0; j < g.cols; j++) {
        lats.push((g.south + i * g.step).toFixed(3));
        lons.push((g.west + j * g.step).toFixed(3));
      }
    const data = await request(
      `${layer.url}?latitude=${lats.join(",")}&longitude=${lons.join(",")}&current=${layer.field}&timezone=UTC`,
      { timeout: 15000 },
    ).catch(() => {
      throw fail("Data heatmap sedang tidak tersedia.", 503);
    });
    const list = Array.isArray(data) ? data : [data];
    const flat = list.map((d) => {
      const v = Number(d?.current?.[layer.field]);
      return Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
    });
    if (flat.length !== g.rows * g.cols) throw fail("Data heatmap tidak lengkap.", 502);
    const values = Array.from({ length: g.rows }, (_, i) => flat.slice(i * g.cols, (i + 1) * g.cols));
    const body = {
      layer: url.searchParams.get("layer"),
      ...g,
      values,
      unit: layer.unit,
      source: layer.source,
      valid_at: list[0]?.current?.time ? list[0].current.time + "Z" : null,
    };
    if (cache.size > 200) cache.clear();
    cache.set(key, { body, until: now() + 1800000 });
    send(res, 200, body);
    return true;
  };
}

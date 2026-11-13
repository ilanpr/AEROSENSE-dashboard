// Weather outlook and regional hazards for the Hub, the Beranda, the map and AERO-BOT. Public, no account.
// Forecast: Open-Meteo. Tropical cyclones: GDACS. Earthquakes M5+: BMKG. All cached in memory.
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

// WMO weather codes → Indonesian label and icon name used by the web.
const WMO = [
  [[0], "Cerah", "clear"],
  [[1], "Cerah berawan", "partly"],
  [[2], "Berawan sebagian", "partly"],
  [[3], "Berawan", "cloudy"],
  [[45, 48], "Berkabut", "fog"],
  [[51, 53, 55, 56, 57], "Gerimis", "drizzle"],
  [[61, 66, 80], "Hujan ringan", "rain"],
  [[63, 81], "Hujan sedang", "rain"],
  [[65, 67, 82], "Hujan lebat", "heavy-rain"],
  [[71, 73, 75, 77, 85, 86], "Salju", "cloudy"],
  [[95], "Hujan petir", "thunder"],
  [[96, 99], "Hujan petir disertai es", "thunder"],
];
export function weatherLabel(code) {
  const hit = WMO.find(([codes]) => codes.includes(code));
  return hit ? { label: hit[1], icon: hit[2] } : { label: "Tidak diketahui", icon: "cloudy" };
}
const round = (v, d = 0) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
const hourLabel = (t) => String(t).slice(11, 16).replace(":", ".") + " WIB";

// Warnings for the next 24 hours, in plain language with what to do.
export function weatherAlerts(hourly, daily) {
  const alerts = [];
  const span = (list) =>
    list.length ? `${hourLabel(list[0].time)}–${hourLabel(list[list.length - 1].time)}` : "";
  const thunder = hourly.filter(
    (h) => h.code >= 95 || (h.cape >= 1500 && (h.rain_chance ?? 0) >= 40),
  );
  if (thunder.length)
    alerts.push({
      type: "thunder",
      level: "warning",
      title: "Potensi hujan petir",
      text: `Sekitar ${span(thunder)}. Hindari berteduh di bawah pohon atau di lapangan terbuka, cabut perangkat listrik yang tidak perlu.`,
    });
  const heavy = hourly.filter((h) => h.rain >= 10);
  const heavyDay = daily.slice(0, 2).find((d) => d.rain >= 20);
  if (heavy.length || heavyDay)
    alerts.push({
      type: "heavy_rain",
      level: heavy.some((h) => h.rain >= 20) || heavyDay?.rain >= 50 ? "danger" : "warning",
      title: "Hujan lebat",
      text: heavy.length
        ? `Intensitas tinggi sekitar ${span(heavy)}. Waspadai genangan dan banjir lokal, hindari berkendara melewati air yang dalam.`
        : `Akumulasi sekitar ${round(heavyDay.rain)} mm pada ${heavyDay.date}. Bersihkan saluran air dan siapkan jas hujan.`,
    });
  const gust = Math.max(0, ...hourly.map((h) => h.gust ?? 0));
  if (gust >= 50)
    alerts.push({
      type: "wind",
      level: gust >= 70 ? "danger" : "warning",
      title: "Angin kencang",
      text: `Hembusan hingga ${round(gust)} km/jam. Amankan benda yang mudah terbang dan jauhi baliho atau pohon rapuh.`,
    });
  const hot = Math.max(-99, ...hourly.map((h) => h.temperature ?? -99));
  if (hot >= 35)
    alerts.push({
      type: "heat",
      level: hot >= 37 ? "danger" : "warning",
      title: "Cuaca sangat panas",
      text: `Suhu hingga ${round(hot)} °C. Minum air putih yang cukup dan kurangi aktivitas berat pukul 11.00–15.00.`,
    });
  const uv = daily[0]?.uv;
  if (uv >= 8)
    alerts.push({
      type: "uv",
      level: uv >= 11 ? "danger" : "warning",
      title: "UV sangat tinggi",
      text: `Indeks UV hingga ${round(uv)}. Pakai topi, tabir surya, dan berteduh saat siang.`,
    });
  return alerts;
}

// Open-Meteo response → compact outlook. `now` picks the first hour shown.
export function parseForecast(data, now = Date.now()) {
  const c = data?.current,
    h = data?.hourly,
    d = data?.daily;
  if (!c || !Array.isArray(h?.time) || !Array.isArray(d?.time)) throw fail("Format prakiraan berubah.", 502);
  // Times are local (Asia/Jakarta, UTC+7) without an offset.
  const local = new Date(now + 7 * 3600000).toISOString().slice(0, 13);
  const start = Math.max(0, h.time.findIndex((t) => t.slice(0, 13) >= local));
  const hourly = h.time.slice(start, start + 24).map((time, k) => {
    const i = start + k;
    return {
      time,
      temperature: round(h.temperature_2m?.[i], 1),
      rain_chance: round(h.precipitation_probability?.[i]),
      rain: round(h.precipitation?.[i], 1),
      code: h.weather_code?.[i] ?? null,
      cape: round(h.cape?.[i]),
      gust: round(h.wind_gusts_10m?.[i]),
      ...weatherLabel(h.weather_code?.[i]),
    };
  });
  const daily = d.time.map((date, i) => ({
    date,
    code: d.weather_code?.[i] ?? null,
    ...weatherLabel(d.weather_code?.[i]),
    max: round(d.temperature_2m_max?.[i], 1),
    min: round(d.temperature_2m_min?.[i], 1),
    rain: round(d.precipitation_sum?.[i], 1),
    rain_chance: round(d.precipitation_probability_max?.[i]),
    gust: round(d.wind_gusts_10m_max?.[i]),
    uv: round(d.uv_index_max?.[i], 1),
  }));
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    source: "Open-Meteo (model cuaca)",
    valid_at: c.time ? c.time + ":00+07:00" : null,
    current: {
      temperature: round(c.temperature_2m, 1),
      feels_like: round(c.apparent_temperature, 1),
      humidity: round(c.relative_humidity_2m),
      rain: round(c.precipitation, 1),
      cloud: round(c.cloud_cover),
      wind: round(c.wind_speed_10m),
      wind_direction: round(c.wind_direction_10m),
      gust: round(c.wind_gusts_10m),
      is_day: c.is_day === 1,
      code: c.weather_code ?? null,
      ...weatherLabel(c.weather_code),
    },
    hourly,
    daily,
    alerts: weatherAlerts(hourly, daily),
  };
}

// The Indonesian region (with its seas) where a cyclone or earthquake matters to users.
const REGION = { south: -20, north: 15, west: 85, east: 150 };
const inRegion = (lat, lng) =>
  lat >= REGION.south && lat <= REGION.north && lng >= REGION.west && lng <= REGION.east;

export function parseCyclones(geo, now = Date.now()) {
  if (!Array.isArray(geo?.features)) throw fail("Format GDACS berubah.", 502);
  const out = [];
  for (const f of geo.features) {
    const p = f?.properties || {};
    const [lng, lat] = f?.geometry?.coordinates || [];
    if (p.eventtype !== "TC" || !Number.isFinite(lat) || !Number.isFinite(lng) || !inRegion(lat, lng)) continue;
    const to = Date.parse(p.todate);
    // Only storms still active (updated within two days).
    if (String(p.iscurrent) !== "true" && !(to > now - 2 * 86400000)) continue;
    out.push({
      id: "tc-" + p.eventid,
      name: String(p.name || p.eventname || "Siklon tropis").slice(0, 80),
      latitude: lat,
      longitude: lng,
      level: String(p.alertlevel || "Green").toLowerCase(),
      severity: String(p.severitydata?.severitytext || "").slice(0, 160),
      updated_at: Number.isFinite(to) ? new Date(to).toISOString() : null,
      url: typeof p.url?.report === "string" && p.url.report.startsWith("https://") ? p.url.report : null,
    });
  }
  return out;
}

export function parseQuakes(data, now = Date.now()) {
  const rows = data?.Infogempa?.gempa;
  if (!Array.isArray(rows)) throw fail("Format BMKG berubah.", 502);
  return rows
    .map((g) => {
      const [lat, lng] = String(g.Coordinates || "").split(",").map(Number);
      const time = Date.parse(g.DateTime);
      return {
        id: "eq-" + g.DateTime,
        latitude: lat,
        longitude: lng,
        magnitude: Number(String(g.Magnitude).replace(",", ".")),
        depth: String(g.Kedalaman || "").slice(0, 20),
        region: String(g.Wilayah || "").slice(0, 160),
        potential: String(g.Potensi || "").slice(0, 160),
        time: Number.isFinite(time) ? new Date(time).toISOString() : null,
      };
    })
    .filter(
      (q) =>
        Number.isFinite(q.latitude) &&
        Number.isFinite(q.longitude) &&
        Number.isFinite(q.magnitude) &&
        q.time &&
        now - Date.parse(q.time) < 7 * 86400000,
    )
    .slice(0, 15);
}

const distanceKm = (a, b) => {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.latitude - a.latitude) * r) / 2) ** 2 +
    Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(((b.longitude - a.longitude) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
};

// Three short facts for AERO-BOT, in the same shape as the other external facts it reads.
export function weatherFacts(outlook, hazards, area, now = Date.now()) {
  const facts = [];
  const fact = (id, label, value, category = "weather") => ({
    id: "outlook-" + id,
    area_id: area.id || "node",
    fresh_until: new Date(now + 3600000).toISOString(),
    category,
    label,
    value,
    unit: "",
    valid_at: new Date(now).toISOString(),
    source: category === "weather" ? "Open-Meteo" : "GDACS / BMKG",
    kind: "forecast",
    spatial_context: `Model di sekitar titik ${area.name || "node"}, terpisah dari sensor AEROSENSE.`,
    data_origin: "external_api",
    role: "supplementary",
  });
  if (outlook) {
    const h = outlook.hourly;
    const temps = h.map((x) => x.temperature).filter(Number.isFinite);
    const wet = h.filter((x) => (x.rain_chance ?? 0) >= 50 || (x.rain ?? 0) >= 0.5);
    const maxChance = Math.max(0, ...h.map((x) => x.rain_chance ?? 0));
    const gust = Math.max(0, ...h.map((x) => x.gust ?? 0));
    facts.push(
      fact(
        "24h",
        "Prakiraan 24 jam ke depan",
        `Sekarang ${outlook.current.label.toLowerCase()}, ${outlook.current.temperature} °C (terasa ${outlook.current.feels_like} °C). ` +
          (wet.length
            ? `Hujan berpeluang turun mulai ${hourLabel(wet[0].time)} (${wet[0].label.toLowerCase()}, peluang hingga ${maxChance}%). `
            : `Peluang hujan kecil (maksimal ${maxChance}%). `) +
          (temps.length ? `Suhu ${Math.min(...temps)}–${Math.max(...temps)} °C, ` : "") +
          `hembusan angin hingga ${gust} km/jam.`,
      ),
    );
    const days = outlook.daily.slice(1, 4).map((d) => {
      const name = new Date(d.date + "T12:00:00+07:00").toLocaleDateString("id-ID", { weekday: "long", timeZone: "Asia/Jakarta" });
      return `${name}: ${d.label.toLowerCase()}, ${d.min}–${d.max} °C, peluang hujan ${d.rain_chance ?? 0}%`;
    });
    if (days.length) facts.push(fact("days", "Prakiraan 3 hari berikutnya", days.join("; ") + "."));
  }
  const warn = [...(outlook?.alerts || []).map((a) => `${a.title}: ${a.text}`)];
  for (const c of hazards?.cyclones || [])
    warn.push(
      `Siklon tropis ${c.name} (status ${c.level}) di ${Math.abs(c.latitude).toFixed(1)}°${c.latitude < 0 ? "LS" : "LU"} ${c.longitude.toFixed(1)}°BT, sekitar ${Math.round(distanceKm(area, c))} km dari titik ini.`,
    );
  const quake = (hazards?.quakes || []).find((q) => distanceKm(area, q) <= 500);
  if (quake)
    warn.push(
      `Gempa M${quake.magnitude} ${quake.region}, kedalaman ${quake.depth}, sekitar ${Math.round(distanceKm(area, quake))} km dari titik ini. ${quake.potential}`,
    );
  facts.push(
    fact(
      "alerts",
      "Peringatan cuaca dan bencana",
      warn.length
        ? warn.join(" ")
        : "Tidak ada peringatan cuaca ekstrem dalam 24 jam, tidak ada siklon tropis aktif di sekitar Indonesia, dan tidak ada gempa M5+ dalam 500 km selama 7 hari terakhir.",
      warn.length ? "weather_alert" : "weather",
    ),
  );
  return facts;
}

const FORECAST =
  "https://api.open-meteo.com/v1/forecast?current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day" +
  "&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,cape,wind_gusts_10m" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max,uv_index_max" +
  "&timezone=Asia%2FJakarta&forecast_days=7";
const GDACS = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC";
const BMKG_QUAKES = "https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json";

export function weatherService({ request, now = Date.now }) {
  const cache = new Map();
  async function cached(key, ttl, load) {
    const hit = cache.get(key);
    if (hit && hit.until > now()) return hit.value;
    const value = await load();
    if (cache.size > 500) cache.clear();
    cache.set(key, { value, until: now() + ttl });
    return value;
  }
  const outlook = (latitude, longitude) => {
    // Snap to about 5 km so nearby users share one request.
    const lat = Math.round(latitude * 20) / 20,
      lng = Math.round(longitude * 20) / 20;
    return cached(`wx:${lat}:${lng}`, 900000, async () =>
      parseForecast(await request(`${FORECAST}&latitude=${lat}&longitude=${lng}`, { timeout: 8000 }), now()),
    );
  };
  const hazards = () =>
    cached("hazards", 600000, async () => {
      const day = (ms) => new Date(ms).toISOString().slice(0, 10);
      const [tc, eq] = await Promise.allSettled([
        request(`${GDACS}&fromdate=${day(now() - 7 * 86400000)}&todate=${day(now() + 86400000)}`, { timeout: 8000 }),
        request(BMKG_QUAKES, { timeout: 8000 }),
      ]);
      const read = (r, parse) => {
        try {
          return r.status === "fulfilled" ? parse(r.value, now()) : null;
        } catch {
          return null;
        }
      };
      return {
        cyclones: read(tc, parseCyclones),
        quakes: read(eq, parseQuakes),
        sources: ["GDACS (siklon tropis)", "BMKG (gempa M5+)"],
        updated_at: new Date(now()).toISOString(),
      };
    });
  return { outlook, hazards };
}

export function weatherRoutes({ service, send, rate }) {
  return async (req, res, url) => {
    const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0];
    if (url.pathname === "/v1/weather" && req.method === "GET") {
      const lat = Number(url.searchParams.get("lat")),
        lng = Number(url.searchParams.get("lng"));
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
        throw fail("Lokasi tidak valid.");
      rate("wx:" + ip, 40);
      const data = await service.outlook(lat, lng).catch((err) => {
        throw err.status ? err : fail("Prakiraan cuaca sedang tidak tersedia.", 503);
      });
      send(res, 200, data);
      return true;
    }
    if (url.pathname === "/v1/hazards" && req.method === "GET") {
      rate("hz:" + ip, 40);
      send(res, 200, await service.hazards());
      return true;
    }
    return false;
  };
}

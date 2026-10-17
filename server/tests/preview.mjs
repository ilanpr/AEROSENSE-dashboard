// Local fixture server for browser checks. It never connects to a real database or n8n.
import http from "node:http";
const userId = "00000000-0000-4000-8000-000000000001";
const viewerId = "00000000-0000-4000-8000-000000000002";
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "preview@example.test",
  created_at: new Date().toISOString(),
  user_metadata: { name: "Preview" },
};
const token =
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  ) +
  "." +
  Buffer.from(
    JSON.stringify({
      sub: userId,
      aud: "authenticated",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url") +
  ".fixture";
const area = {
  id: "surabaya",
  name: "Surabaya · Pratinjau data contoh",
  latitude: -7.24917,
  longitude: 112.75083,
  coordinate_source: "city_reference",
  enabled: true,
};
const node = {
  id: "node-preview",
  name: "Node pengujian lokal",
  latitude: -7.28,
  longitude: 112.78,
  gateway_id: "gateway-preview",
  location_id: "preview-area",
  enabled: true,
  pm25_validated: false,
};
const jobs = [];
const newsTime = new Date().toISOString();
const facts = [
  ["weather", "Suhu udara", 30, "°C"],
  ["weather", "Kelembapan udara", 72, "%"],
  ["weather", "Kecepatan angin", 12, "km/jam"],
  ["weather", "Kode kondisi cuaca (WMO)", 0, ""],
  ["soil", "Estimasi kadar air tanah 0–1 cm", 0.34, "m³/m³"],
  ["air_quality", "Estimasi PM2.5 wilayah", 16, "µg/m³"],
  ["air_quality", "Estimasi AQI US wilayah, bukan ISPU", 54, "indeks US AQI"],
  ["fire", "Jumlah titik panas pada feed satelit 24 jam", 0, "titik"],
  [
    "earthquake",
    "Cakupan hasil gempa BMKG",
    "Tidak ada entri pada daftar M5+ dalam radius contoh.",
    "",
  ],
  ["flood", "Prakiraan debit sungai", 12, "m³/s"],
].map(([category, label, value, unit], i) => ({
  id: "fixture-" + i,
  area_id: area.id,
  category,
  label,
  value,
  unit,
  reference: { latitude: area.latitude, longitude: area.longitude },
  valid_at:
    category === "flood"
      ? new Date(Date.now() + 3600000).toISOString()
      : new Date().toISOString(),
  fresh_until: new Date(Date.now() + 3600000).toISOString(),
  kind:
    {
      fire: "satellite",
      earthquake: "event",
      flood: "forecast",
    }[category] || "model",
  source: "Open-Meteo / data pengujian lokal",
  source_url: "https://open-meteo.com/",
  spatial_context:
    "Nilai sintetis untuk memeriksa tampilan, bukan kondisi lapangan.",
}));
facts.unshift({
  ...facts[0],
  id: "fixture-old",
  value: 99,
  valid_at: new Date(Date.now() - 86400000).toISOString(),
  fresh_until: new Date(Date.now() - 1000).toISOString(),
});
// Opt in to real public headlines while sensor/weather fixtures stay synthetic.
let publicNewsRows = null;
if (process.env.PREVIEW_LIVE_NEWS === "true") {
  publicNewsRows = [];
  const { disasterNews } = await import("../api/disaster-news.mjs");
  const news = disasterNews({db:async (_table,_query,method,body) => {
    if (method === "POST") {publicNewsRows=publicNewsRows.filter(r=>r.provider!==body.provider).concat(body);return null;}
    return publicNewsRows;
  }});
  await news.refresh();
}
const mock = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  let raw = "";
  for await (const c of req) raw += c;
  const p = raw ? JSON.parse(raw) : null;
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:4173");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization,apikey,content-type,x-client-info,x-supabase-api-version",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  let output = [];
  if (url.pathname === "/rest/v1/ae_disaster_news_cache") output = publicNewsRows || [{
    provider: "gdacs", last_success_at: newsTime, refresh_after: new Date(Date.now()+3600000).toISOString(), last_error:null,
    items: [
      {id:"example-fire", title:"Contoh pantauan karhutla", original_title:"Data sintetis untuk pratinjau, bukan kejadian nyata", url:"https://www.gdacs.org/", source:"GDACS · contoh tampilan", published_at:newsTime, kind:"monitoring",type:"Karhutla",location:"Indonesia",country_code:"IDN",metrics:[{value:1200,unit:"ha",label:"Estimasi area GDACS"}]},
      {id:"example-flood", title:"Contoh pantauan banjir", original_title:"Data sintetis untuk pratinjau, bukan kejadian nyata", url:"https://www.gdacs.org/report.aspx?eventtype=FL", source:"GDACS · contoh tampilan", published_at:newsTime, kind:"monitoring",type:"Banjir",location:"Indonesia",country_code:"IDN",metrics:[]}
    ]
  }];
  if (url.pathname === "/auth/v1/token") {
    if (
      p?.password !== "fixture-password" &&
      p?.grant_type !== "refresh_token"
    ) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "Invalid login credentials",
        }),
      );
      return;
    }
    const isViewer =
      p?.email === "viewer@example.test" ||
      p?.refresh_token === "fixture-viewer";
    output = {
      access_token: isViewer
        ? token.replace(/fixture$/, "fixture-viewer")
        : token,
      refresh_token: "fixture-refresh",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: isViewer
        ? { ...user, id: viewerId, email: "viewer@example.test" }
        : user,
    };
  }
  if (url.pathname === "/auth/v1/user")
    output = req.headers.authorization?.endsWith("fixture-viewer")
      ? { ...user, id: viewerId, email: "viewer@example.test" }
      : user;
  if (url.pathname === "/auth/v1/logout") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (url.pathname === "/rest/v1/ae_members")
    output = [
      {
        user_id:
          url.searchParams.get("user_id") === "eq." + viewerId
            ? viewerId
            : userId,
        location_id: node.location_id,
        role:
          url.searchParams.get("user_id") === "eq." + viewerId
            ? "viewer"
            : "admin",
      },
    ];
  if (url.pathname === "/rest/v1/ae_nodes") output = [node];
  if (url.pathname === "/rest/v1/ae_sensor_context")
    output = [
      {
        node_id: node.id,
        name: node.name,
        reading_id: null,
        observed_at: null,
        received_at: null,
        metrics: {},
        gru: null,
        stale: true,
        quality: {},
      },
    ];
  if (url.pathname === "/rest/v1/ae_environment_areas") output = [area];
  if (url.pathname === "/rest/v1/ae_environment_area_cache")
    output = ["openmeteo_weather", "openmeteo_air"].map((provider) => ({
      provider,
      area_id: area.id,
      request_latitude: area.latitude,
      request_longitude: area.longitude,
      payload: {
        facts: facts.filter((f) =>
          provider === "openmeteo_air"
            ? f.category === "air_quality"
            : f.category !== "air_quality",
        ),
      },
      last_attempt_at: new Date().toISOString(),
      refresh_after: new Date(Date.now() + 3600000).toISOString(),
    }));
  if (url.pathname === "/rest/v1/ae_jobs") {
    if (req.method === "POST") {
      const old = jobs.find((j) => j.dedupe_key === p.dedupe_key);
      if (old) output = [];
      else {
        const j = {
          ...p,
          id: crypto.randomUUID(),
          status: "pending",
          created: Date.now(),
        };
        jobs.push(j);
        output = [j];
      }
    } else {
      output = jobs.filter(
        (j) =>
          (!url.searchParams.get("id") ||
            url.searchParams.get("id") === "eq." + j.id) &&
          (!url.searchParams.get("dedupe_key") ||
            url.searchParams.get("dedupe_key") === "eq." + j.dedupe_key),
      );
      for (const j of output)
        if (Date.now() - j.created > 1000) {
          j.status = "done";
          j.result = {
            text: "Hasil pengujian lokal: pertanyaan sudah terkirim dan jawaban berhasil dibaca kembali melalui job. Pembacaan sensor belum tersedia.",
            denied: false,
          };
        }
    }
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(output));
});
await new Promise((r) => mock.listen(18089, "127.0.0.1", r));
Object.assign(process.env, {
  PORT: "8081",
  SUPABASE_URL: "http://127.0.0.1:18089",
  SUPABASE_ANON_KEY: "fixture-public",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-private",
  INTERNAL_API_KEY: "fixture-internal",
  DEVICE_KEYS_JSON: "{}",
  WEB_ORIGINS: "http://127.0.0.1:4173",
  DISASTER_NEWS_ENABLED: "false",
});
await import("../api/server.mjs");
console.log(
  "LOCAL FIXTURES ONLY. Login preview@example.test / fixture-password. No production data.",
);

// Ringkasan singkat dari fakta yang masih berlaku. Tidak memakai Gemini.
/* oxlint-disable no-control-regex */
function normalizeHazardEvents(
  provider,
  data,
  area,
  now = Date.now(),
  radiusKm = provider === "firms" ? 50 : 300,
) {
  const clean = (v) =>
    String(v ?? "")
      .replace(/[<>\r\n\u0000-\u001f]/g, " ")
      .trim()
      .slice(0, 180);
  const number = (v) =>
    v == null || String(v).trim() === "" ? NaN : Number(String(v).trim().replace(",", "."));
  const coordinate = (lat, lon) =>
    Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const distance = (lat, lon) => {
    const rad = Math.PI / 180,
      h =
        Math.sin(((lat - area.latitude) * rad) / 2) ** 2 +
        Math.cos(area.latitude * rad) *
          Math.cos(lat * rad) *
          Math.sin(((lon - area.longitude) * rad) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
  };
  if (!["firms", "bmkg_quake"].includes(provider) || !coordinate(area.latitude, area.longitude))
    throw Error("Area kejadian tidak valid");
  const fire = provider === "firms",
    maxAge = (fire ? 1 : 7) * 86400000,
    limit = fire ? 200 : 30;
  const rows = fire ? data : data?.Infogempa?.gempa;
  if (!Array.isArray(rows)) throw Error("Skema kejadian berubah");
  const byId = new Map();
  for (const row of rows) {
    const xy = fire ? [row.latitude, row.longitude] : String(row.Coordinates ?? "").split(",");
    const latitude = number(xy[0]),
      longitude = number(xy[1]);
    if (!coordinate(latitude, longitude)) continue;
    const clock = String(row.acq_time ?? "").padStart(4, "0");
    const observed = fire
      ? /^\d{4}$/.test(clock)
        ? `${row.acq_date}T${clock.slice(0, 2)}:${clock.slice(2)}:00Z`
        : ""
      : row.DateTime;
    const time = Date.parse(observed);
    if (!Number.isFinite(time) || time > now || time < now - maxAge) continue;
    const distance_km = distance(latitude, longitude);
    if (distance_km > radiusKm) continue;
    const magnitude = number(row.Magnitude);
    if (!fire && (!Number.isFinite(magnitude) || magnitude < 0 || magnitude > 10.5)) continue;
    const observed_at = new Date(time).toISOString();
    const satellite = fire ? clean(row.satellite) : null;
    const id = `${provider}:${observed_at}:${latitude}:${longitude}:${satellite || ""}`;
    const depth = number(String(row.Kedalaman ?? "").replace(/\s*km\s*$/i, ""));
    byId.set(id, {
      id,
      area_id: area.id,
      provider,
      category: fire ? "fire" : "earthquake",
      latitude,
      longitude,
      observed_at,
      fetched_at: new Date(now).toISOString(),
      fresh_until: new Date(now + 7200000).toISOString(),
      distance_km,
      title: fire ? "Titik panas satelit" : clean(row.Wilayah) || "Episenter gempa BMKG",
      source: fire ? "NASA FIRMS / VIIRS" : "BMKG",
      source_url: fire
        ? "https://firms.modaps.eosdis.nasa.gov/"
        : "https://data.bmkg.go.id/gempabumi/",
      coordinate_kind: fire ? "satellite_pixel_center" : "epicenter",
      data_origin: "external_api",
      role: "supplementary",
      reference: { latitude: area.latitude, longitude: area.longitude },
      ...(fire
        ? {
            satellite,
            confidence:
              { l: "low", n: "nominal", h: "high", low: "low", nominal: "nominal", high: "high" }[
                String(row.confidence).toLowerCase()
              ] || null,
          }
        : {
            magnitude,
            depth_km: Number.isFinite(depth) && depth >= 0 ? depth : null,
            felt: clean(row.Dirasakan) || null,
            potential: clean(row.Potensi) || null,
          }),
    });
  }
  const all = [...byId.values()].sort(
    (a, b) =>
      Date.parse(b.observed_at) - Date.parse(a.observed_at) || a.distance_km - b.distance_km,
  );
  return {
    events: all.slice(0, limit),
    coverage: {
      radius_km: radiusKm,
      window_hours: fire ? 24 : 168,
      matched_count: all.length,
      returned_count: Math.min(all.length, limit),
      truncated: all.length > limit,
      feed: fire ? "VIIRS 24 jam" : "Daftar terakhir gempa M5+ BMKG; bukan seluruh gempa",
    },
  };
}
function summarizeEnvironment(facts, now = Date.now()) {
  const time = (f) => Date.parse(f.valid_at || f.fetched_at || "") || 0;
  const day = (t) => new Date(t + 7 * 3600000).toISOString().slice(0, 10);
  const fresh = facts.filter((f) => !f.stale && Date.parse(f.fresh_until) > now);
  const current = fresh
    .filter(
      (f) =>
        !["forecast", "historical", "event", "static_model"].includes(f.kind) &&
        (f.valid_at ? time(f) > 0 && time(f) <= now + 1800000 : f.kind === "satellite"),
    )
    .sort((a, b) => time(b) - time(a));
  const match = (list, category, pattern) =>
    list.find(
      (f) =>
        f.category === category &&
        pattern.test(f.label) &&
        typeof f.value === "number" &&
        Number.isFinite(f.value),
    );
  const out = [];
  function add(category, title, body, action, used = [], tone = "neutral", period = "current") {
    out.push({
      category,
      title,
      body,
      action,
      tone,
      period,
      available: used.length > 0,
      fact_ids: used.map((f) => f.id),
      valid_at: used[0]?.valid_at || null,
      fresh_until:
        used
          .map((f) => f.fresh_until)
          .filter(Boolean)
          .sort()[0] || null,
      method: "rules-v1",
    });
  }
  const temp = match(current, "weather", /^Suhu udara$/i);
  const rain = match(current, "weather", /Presipitasi interval/i);
  const weatherCode = match(current, "weather", /Kode kondisi cuaca \(WMO\)/i);
  const today = fresh
    .filter((f) => f.kind === "forecast" && f.valid_at && day(time(f)) === day(now))
    .sort((a, b) => time(a) - time(b));
  const chance = match(today, "weather", /peluang presipitasi/i);
  if (weatherCode && [95, 96, 99].includes(weatherCode.value))
    add(
      "weather",
      "Waspadai hujan petir",
      "Model cuaca wilayah menunjukkan kondisi hujan disertai petir.",
      "Tunda aktivitas di area terbuka saat petir terdengar.",
      [weatherCode, ...(temp ? [temp] : [])],
      "warning",
    );
  else if (
    (rain && rain.value > 0) ||
    (weatherCode &&
      [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode.value))
  )
    add(
      "weather",
      "Hujan di sekitar titik acuan",
      "Model wilayah menunjukkan hujan pada interval terbaru.",
      "Siapkan payung sebelum keluar.",
      [...(rain ? [rain] : []), ...(weatherCode ? [weatherCode] : []), ...(temp ? [temp] : [])],
      "notice",
    );
  else if (temp)
    add(
      "weather",
      temp.value >= 32
        ? "Cuaca terasa panas"
        : temp.value >= 26
          ? "Cuaca terasa hangat"
          : "Cuaca terasa sejuk",
      chance && chance.value >= 60
        ? "Prakiraan hari ini juga menunjukkan peluang hujan."
        : `Suhu wilayah diperkirakan sekitar ${Math.round(temp.value)}°C. Kondisi di tiap lokasi bisa berbeda.`,
      chance && chance.value >= 60
        ? "Bawa payung untuk berjaga-jaga."
        : temp.value >= 26
          ? "Pilih tempat teduh saat beraktivitas di luar."
          : "Sesuaikan pakaian agar tetap nyaman.",
      [temp, ...(chance ? [chance] : [])],
      temp.value >= 32 ? "warm" : "calm",
    );
  else if (chance)
    add(
      "weather",
      "Ada prakiraan untuk hari ini",
      "Pembacaan cuaca saat ini belum tersedia.",
      chance.value >= 60
        ? "Siapkan payung; ada peluang hujan."
        : "Lihat prakiraan sebelum beraktivitas.",
      [chance],
      "neutral",
      "forecast",
    );
  else
    add(
      "weather",
      "Cuaca belum tersedia",
      "Kami belum punya data yang cukup baru untuk merangkum cuaca.",
      "Coba perbarui beberapa saat lagi.",
    );
  const aqi = match(current, "air_quality", /(AQI US|US AQI)/i);
  const ispu = match(current, "air_quality", /^Estimasi ISPU PM2\.5 \(24 jam\)$/);
  if (ispu && ispu.value >= 0) {
    const bands = [
      [50, "baik", "Partikel halus berada pada kategori baik untuk wilayah ini.", "calm"],
      [100, "sedang", "Orang yang peka terhadap polusi mungkin perlu mengurangi aktivitas berat di luar.", "notice"],
      [200, "tidak sehat", "Pertimbangkan mengurangi aktivitas berat atau lama di luar.", "warning"],
      [300, "sangat tidak sehat", "Jika memungkinkan, pindahkan aktivitas luar ke dalam ruangan.", "danger"],
      [Infinity, "berbahaya", "Hindari aktivitas luar ruangan dan ikuti arahan resmi.", "danger"],
    ];
    const [, label, action, tone] = bands.find(([max]) => ispu.value <= max);
    add(
      "air_quality",
      `Kualitas udara ${label}`,
      "Kategori wilayah berdasarkan estimasi partikel halus selama 24 jam.",
      action,
      [ispu],
      tone,
    );
  } else if (aqi && aqi.value >= 0) {
    const bands = [
      [
        50,
        "Udara baik",
        "Kategori baik menurut indeks US AQI wilayah.",
        "Tetap pilih rute yang jauh dari asap kendaraan.",
        "calm",
      ],
      [
        100,
        "Udara sedang",
        "Udara mungkin kurang nyaman bagi orang yang sangat sensitif.",
        "Perhatikan kenyamanan saat beraktivitas di luar.",
        "notice",
      ],
      [
        150,
        "Kurang sehat untuk yang sensitif",
        "Anak-anak, lansia, dan orang dengan gangguan pernapasan perlu lebih berhati-hati.",
        "Kurangi aktivitas berat di luar bila Anda sensitif.",
        "warning",
      ],
      [
        200,
        "Udara tidak sehat",
        "Polusi dapat berdampak pada lebih banyak orang.",
        "Kurangi aktivitas berat atau lama di luar ruang.",
        "warning",
      ],
      [
        300,
        "Udara sangat tidak sehat",
        "Tingkat polusi wilayah memerlukan perhatian lebih.",
        "Pindahkan kegiatan luar ruang ke dalam bila memungkinkan.",
        "danger",
      ],
      [
        Infinity,
        "Udara berbahaya",
        "Indeks polusi wilayah berada pada kategori tertinggi.",
        "Hindari aktivitas luar ruang dan ikuti arahan resmi.",
        "danger",
      ],
    ];
    const [, title, body, action, tone] = bands.find(([max]) => aqi.value <= max);
    add("air_quality", title, body, action, [aqi], tone);
  } else
    add(
      "air_quality",
      "Indeks udara belum tersedia",
      "Indeks kualitas udara terbaru belum tersedia.",
      "Rincian polutan yang tersedia tetap bisa dilihat.",
    );
  const soil = match(current, "soil", /kadar air tanah/i);
  const profile = fresh.filter((f) => f.category === "soil_profile");
  if (soil)
    add(
      "soil",
      "Kelembapan tanah permukaan",
      "Estimasi wilayah untuk lapisan tanah 0–1 cm.",
      "Bandingkan perubahan kelembapan permukaan dengan hujan beberapa hari terakhir.",
      [soil],
      "calm",
    );
  else if (profile.length)
    add(
      "soil",
      "Profil tanah",
      "Peta sifat tanah memberi gambaran umum, bukan kondisi tanah saat ini.",
      "Gunakan pengukuran setempat untuk keputusan perawatan.",
      profile.slice(0, 2),
      "neutral",
      "reference",
    );
  else
    add(
      "soil",
      "Data tanah belum tersedia",
      "Belum ada estimasi tanah terbaru untuk area ini.",
      "Cek kondisi tanah langsung bila diperlukan.",
    );
  const fire = match(current, "fire", /Jumlah (?:deteksi )?titik panas/i);
  if (fire)
    add(
      "fire",
      fire.value > 0 ? "Titik panas terdeteksi" : "Tidak ada titik panas tercatat",
      "Pantauan satelit NASA FIRMS selama 24 jam dalam radius 50 km dari titik acuan.",
      fire.value > 0
        ? "Cek lokasi dan informasi resmi. Titik panas belum tentu kebakaran."
        : "Bila melihat asap atau api, cek informasi dari petugas setempat.",
      [fire],
      fire.value > 0 ? "warning" : "neutral",
      "monitoring",
    );
  else
    add(
      "fire",
      "Pantauan satelit belum tersedia",
      "Feed satelit untuk area ini belum diperbarui.",
      "Gunakan informasi resmi untuk memeriksa kejadian.",
    );
  const rivers = fresh
    .filter((f) =>
      f.category === "flood" && f.kind === "forecast" && /debit sungai/i.test(f.label) &&
      typeof f.value === "number" && Number.isFinite(f.value) && f.value >= 0 &&
      time(f) >= now && time(f) <= now + 48 * 3600000,
    )
    .sort((a, b) => time(a) - time(b));
  const [river] = rivers;
  if (river) {
    const next = rivers.find((f) => f.provider === river.provider && time(f) - time(river) === 86400000);
    const delta = next ? Math.round(next.value * 100) - Math.round(river.value * 100) : null;
    add(
      "flood",
      delta === null ? "Prakiraan aliran sungai"
        : delta > 0 ? "Aliran sungai diperkirakan naik"
          : delta < 0 ? "Aliran sungai diperkirakan turun" : "Aliran sungai diperkirakan relatif tetap",
      next
        ? "Perbandingan dua hari untuk sungai yang dipilih model di sekitar titik acuan."
        : "Baru ada satu hari prakiraan. Arah perubahan aliran belum bisa dibandingkan.",
      "Jika beraktivitas dekat sungai, pantau kondisi setempat dan peringatan resmi.",
      next ? [river, next] : [river],
      "neutral",
      "forecast",
    );
  } else
    add(
      "flood",
      "Prakiraan sungai belum tersedia",
      "Belum ada prakiraan debit untuk hari ini.",
      "Pantau informasi resmi bila hujan meningkat.",
    );
  const quakes = fresh
    .filter((f) => f.category === "earthquake" && f.kind === "event" && time(f) > 0 && time(f) <= now)
    .sort((a, b) => time(b) - time(a));
  const quakeCoverage = fresh.find((f) =>
    f.category === "earthquake" && !f.valid_at && /^Cakupan hasil gempa BMKG$/i.test(f.label),
  );
  if (quakes.length)
    add(
      "earthquake",
      "Ada catatan gempa di sekitar wilayah",
      "Daftar BMKG mencatat gempa magnitudo 5,0 atau lebih dalam radius 300 km dari titik acuan.",
      "Lihat waktu kejadian dan lokasi pusat gempa di peta.",
      quakes.slice(0, 2),
      "neutral",
      "reference",
    );
  else if (quakeCoverage)
    add(
      "earthquake",
      "Tidak ada catatan gempa dalam cakupan",
      "Tidak ada gempa M5,0+ dalam radius 300 km pada daftar BMKG yang diperiksa untuk 7 hari terakhir.",
      "Gempa di bawah M5,0 bisa tidak muncul di daftar ini.",
      [quakeCoverage],
      "neutral",
      "reference",
    );
  else
    add(
      "earthquake",
      "Catatan gempa belum tersedia",
      "Data yang tersedia belum cukup baru untuk ditampilkan.",
      "Cek BMKG untuk informasi kejadian terkini.",
    );
  return out;
}
function normalizeResponse(response, request, now = Date.now()) {
  function pm25Ispu(mean) {
    const concentrations = [0, 15.5, 55.4, 150.4, 250.4, 500];
    const scores = [0, 50, 100, 200, 300, 500];
    const x = Math.min(mean, 500);
    const i = concentrations.findIndex((limit, index) => index > 0 && x <= limit);
    const fraction = (x - concentrations[i - 1]) / (concentrations[i] - concentrations[i - 1]);
    return Math.round(scores[i - 1] + fraction * (scores[i] - scores[i - 1]));
  }
  const fetched_at = new Date(now).toISOString();
  const clean = (v) =>
    String(v ?? "")
      .replace(/[<>\r\n\u0000-\u001f]/g, " ")
      .trim()
      .slice(0, 180);
  const iso = (v) => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? new Date(v * 1000).toISOString() : null;
    const s = String(v).replace(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d)$/, "$1T$2");
    const naive = /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(s);
    const offset =
      request.provider.startsWith("openmeteo_") && Number.isFinite(d?.utc_offset_seconds)
        ? d.utc_offset_seconds
        : 0;
    const t = Date.parse(naive ? s + "Z" : s) - (naive ? offset * 1000 : 0);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  };
  const distance = (a, b, c, d) => {
    const r = (x) => (x * Math.PI) / 180;
    const h =
      Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
  };
  function csv(text) {
    let rows = [],
      row = [],
      cell = "",
      quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = !quoted;
      } else if (c === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if (c === "\n" && !quoted) {
        row.push(cell.replace(/\r$/, ""));
        rows.push(row);
        row = [];
        cell = "";
      } else cell += c;
    }
    if (cell || row.length) {
      row.push(cell);
      rows.push(row);
    }
    const header = rows.shift() || [];
    if (!header.includes("latitude") || !header.includes("acq_date"))
      throw Error("Skema CSV FIRMS berubah");
    return rows
      .filter((r) => r.length === header.length)
      .map((r) => Object.fromEntries(header.map((k, i) => [k, r[i]])));
  }
  let d = response.body ?? response;
  let error = null;
  try {
    if (response.error || (response.statusCode && response.statusCode >= 400))
      throw Error("Provider tidak tersedia");
    if (typeof d === "string" && request.provider !== "firms") d = JSON.parse(d);
    if (d?.status === "fail" || d?.error) throw Error("Provider menolak permintaan");
    if (request.provider === "firms") d = csv(typeof d === "string" ? d : String(d?.data || ""));
  } catch {
    error = "Permintaan gagal atau format respons tidak sesuai";
  }
  const sourceError = error;
  const entries = [];
  for (const n of request.targets || []) {
    error = sourceError;
    const facts = [];
    const reference = {
      id: n.id,
      name: clean(n.name || n.id),
      latitude: n.latitude,
      longitude: n.longitude,
      coordinate_source: n.coordinate_source || "configured_reference",
      timezone: n.timezone || "Asia/Jakarta",
    };
    let provider_coordinates = null,
      distance_km = null;
    const coordinate = (lat, lon) =>
      Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    let spatial_context = `Wilayah sekitar ${clean(n.name || n.id)}`;
    if (coordinate(d?.latitude, d?.longitude)) {
      provider_coordinates = { latitude: d.latitude, longitude: d.longitude, kind: "model_grid" };
      distance_km = distance(n.latitude, n.longitude, d.latitude, d.longitude);
      spatial_context += `; pusat grid model ${d.latitude}, ${d.longitude}, sekitar ${distance_km.toFixed(1)} km dari acuan robot`;
    }
    const maxGridDistance = { openmeteo_weather: 50, openmeteo_air: 100, openmeteo_flood: 25 }[
      request.provider
    ];
    if (!error && maxGridDistance && (!provider_coordinates || distance_km > maxGridDistance))
      error = "Grid penyedia tidak cocok dengan area acuan robot";
    let events = [],
      event_coverage = null;
    const add = (
      key,
      category,
      label,
      value,
      unit,
      valid_at,
      kind,
      max_age = 21600,
      extra = {},
    ) => {
      if (
        value === null ||
        value === undefined ||
        (typeof value === "number" && !Number.isFinite(value))
      )
        return;
      if (!["string", "number"].includes(typeof value)) return;
      if (typeof value === "number" && category !== "weather" && category !== "soil" && value < 0)
        return;
      const valid = iso(valid_at);
      if (
        ["model", "regional"].includes(kind) &&
        ["weather", "soil", "air_quality"].includes(category) &&
        (!valid || Date.parse(valid) > now + 1800000)
      )
        return;
      if (valid && Date.parse(valid) > now + 8 * 86400000) return;
      const historical = ["soil_profile", "earthquake", "fire"].includes(category);
      const fresh_until = new Date(
        historical || !valid ? now + max_age * 1000 : Date.parse(valid) + max_age * 1000,
      ).toISOString();
      facts.push({
        id: `${request.provider}:${n.id}:${key}:${valid || "static"}`,
        area_id: n.id,
        provider: request.provider,
        category,
        label: clean(label),
        value: typeof value === "number" ? value : clean(value),
        unit: clean(unit),
        valid_at: valid,
        fresh_until,
        source: request.source,
        source_url: request.source_url,
        kind,
        spatial_context,
        data_origin: "external_api",
        role: "supplementary",
        reference,
        provider_coordinates,
        provider_location_known: provider_coordinates !== null,
        distance_km,
        ...extra,
      });
    };
    if (!error)
      try {
        if (request.provider === "openmeteo_weather") {
          if (!d.current || !d.hourly) throw Error("Data cuaca kosong");
          const labels = {
            weather_code: ["Kode kondisi cuaca (WMO)", ""],
            temperature_2m: ["Suhu udara", "°C"],
            relative_humidity_2m: ["Kelembapan udara", "%"],
            precipitation: ["Presipitasi interval saat ini", "mm"],
            wind_speed_10m: ["Kecepatan angin", "km/jam"],
          };
          for (const [k, [label, unit]] of Object.entries(labels))
            add(k, "weather", label, d.current[k], unit, d.current.time, "model");
          const hi = d.hourly.time.findLastIndex((t) => Date.parse(iso(t)) <= now);
          if (hi >= 0) {
            const hourly = d.hourly;
            const soilHistory = hourly.time
              .map((time, i) => {
                const moisture = hourly.soil_moisture_0_to_1cm?.[i];
                const rain = hourly.precipitation?.[i];
                return {
                  at: iso(time),
                  moisture_pct: Number.isFinite(moisture) && moisture >= 0 && moisture <= 1 ? moisture * 100 : null,
                  rain_mm: Number.isFinite(rain) && rain >= 0 ? rain : null,
                };
              })
              .filter(({ at }) => Date.parse(at) > now - 72 * 3600000 && Date.parse(at) <= now);
            add(
              "soil_t",
              "soil",
              "Estimasi suhu tanah permukaan",
              d.hourly.soil_temperature_0cm?.[hi],
              "°C",
              d.hourly.time[hi],
              "model",
            );
            add(
              "soil_m",
              "soil",
              "Estimasi kadar air tanah 0–1 cm",
              d.hourly.soil_moisture_0_to_1cm?.[hi],
              "m³/m³",
              d.hourly.time[hi],
              "model",
              21600,
              { soil_history: soilHistory },
            );
          }
          const daily = {
            temperature_2m_max: ["Prakiraan suhu maksimum", "°C"],
            temperature_2m_min: ["Prakiraan suhu minimum", "°C"],
            precipitation_sum: ["Prakiraan total presipitasi", "mm"],
            precipitation_probability_max: ["Prakiraan peluang presipitasi maksimum", "%"],
            uv_index_max: ["Prakiraan indeks UV maksimum", ""],
          };
          const today = new Date(now + 7 * 3600000).toISOString().slice(0, 10);
          for (let i = 0; i < (d.daily?.time || []).length; i++) {
            if (d.daily.time[i] < today) continue;
            for (const [k, [label, unit]] of Object.entries(daily))
              add(
                k + i,
                "weather",
                `${label} (hari WIB ${d.daily.time[i]})`,
                d.daily[k]?.[i],
                unit,
                d.daily.time[i] + "T23:59:59",
                "forecast",
                10800,
              );
          }
        } else if (request.provider === "openmeteo_air") {
          if (!d.current) throw Error("Data polutan kosong");
          const labels = {
            pm2_5: "Estimasi PM2.5 wilayah",
            pm10: "Estimasi PM10 wilayah",
            carbon_monoxide: "Estimasi CO wilayah",
            nitrogen_dioxide: "Estimasi NO₂ wilayah",
            sulphur_dioxide: "Estimasi SO₂ wilayah",
            ozone: "Estimasi ozon wilayah",
            us_aqi: "Estimasi AQI US wilayah, bukan ISPU",
          };
          for (const [k, label] of Object.entries(labels))
            add(
              k,
              "air_quality",
              label,
              d.current[k],
              k === "us_aqi" ? "indeks US AQI" : "µg/m³",
              d.current.time,
              "model",
              21600,
            );
          const { time, pm2_5 } = d.hourly || {};
          const currentHour = Date.parse(iso(d.current.time));
          if (
            Number.isFinite(currentHour) &&
            Array.isArray(time) &&
            Array.isArray(pm2_5) &&
            time.length === pm2_5.length &&
            /^[µμ]g\/m³$/.test(d.hourly_units?.pm2_5)
          ) {
            const hour = 3600000;
            const end = Math.floor(Math.min(currentHour, now) / hour) * hour;
            const hourly = new Map(time.map((at, i) => [Date.parse(iso(at)), pm2_5[i]]));
            const window = Array.from({ length: 24 }, (_, i) => hourly.get(end - i * hour));
            if (window.every((value) => Number.isFinite(value) && value >= 0)) {
              const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
              const at = new Date(end).toISOString();
              add(
                "ispu_pm2_5", "air_quality", "Estimasi ISPU PM2.5 (24 jam)",
                pm25Ispu(mean), "indeks", at, "model",
              );
              add(
                "pm2_5_24h", "air_quality", "Estimasi rata-rata PM2.5 24 jam",
                mean, "µg/m³", at, "model",
              );
            }
          }
        } else if (request.provider === "openmeteo_flood") {
          if (!d.daily?.time) throw Error("Data debit kosong");
          for (let i = 0; i < d.daily.time.length; i++)
            add(
              "discharge" + i,
              "flood",
              `Prakiraan debit sungai grid sekitar 5 km (hari UTC ${d.daily.time[i]})`,
              d.daily.river_discharge?.[i],
              "m³/s",
              d.daily.time[i] + "T23:59:59Z",
              "forecast",
              86400,
            );
        } else if (request.provider === "soilgrids") {
          if (!Array.isArray(d.properties?.layers)) throw Error("Data sifat tanah kosong");
          const labels = {
            phh2o: "Estimasi pH tanah 0–5 cm",
            soc: "Estimasi karbon organik tanah 0–5 cm",
            clay: "Estimasi fraksi lempung 0–5 cm",
            sand: "Estimasi fraksi pasir 0–5 cm",
          };
          for (const layer of d.properties.layers) {
            const raw = layer.depths?.[0]?.values?.mean,
              factor = layer.unit_measure?.d_factor;
            if (labels[layer.name] && Number.isFinite(raw) && Number.isFinite(factor) && factor > 0)
              add(
                layer.name,
                "soil_profile",
                labels[layer.name],
                raw / factor,
                layer.name === "phh2o" ? "pH" : layer.unit_measure.target_units,
                null,
                "static_model",
                2592000,
                { spatial_context: spatial_context + "; estimasi peta tanah sekitar 250 m" },
              );
          }
        } else if (request.provider === "iqair") {
          if (d.status !== "success" || !d.data?.current?.pollution)
            throw Error("Data IQAir kosong");
          const p = d.data.current.pollution,
            c = d.data;
          const xy = c.location?.coordinates;
          if (Array.isArray(xy) && coordinate(xy[1], xy[0])) {
            provider_coordinates = {
              latitude: xy[1],
              longitude: xy[0],
              kind: "provider_reported_location",
            };
            distance_km = distance(n.latitude, n.longitude, xy[1], xy[0]);
            if (distance_km > 100) throw Error("Lokasi IQAir terlalu jauh dari robot");
          }
          spatial_context = `Kota terdekat IQAir: ${clean(c.city)}, ${clean(c.state)}; lokasi titik pengamatan sebenarnya belum tentu diketahui, bukan sensor AEROSENSE`;
          add(
            "aqius",
            "air_quality",
            "AQI US wilayah dari IQAir",
            p.aqius,
            "indeks US AQI",
            p.ts,
            "regional",
            21600,
          );
          const names = { p2: "PM2.5", p1: "PM10", o3: "Ozon", n2: "NO₂", s2: "SO₂", co: "CO" };
          if (names[p.mainus])
            add(
              "main",
              "air_quality",
              "Polutan utama menurut indeks IQAir",
              names[p.mainus],
              "",
              p.ts,
              "regional",
              21600,
            );
        } else if (request.provider === "bmkg_weather") {
          const forecasts = (d.data || [])
            .flatMap((x) => (x.cuaca || []).flat())
            .filter((x) => iso(x.utc_datetime))
            .sort((a, b) => Date.parse(iso(a.utc_datetime)) - Date.parse(iso(b.utc_datetime)));
          const upcoming = forecasts
            .filter((x) => Date.parse(iso(x.utc_datetime)) >= now - 3 * 3600000)
            .slice(0, 5);
          if (!upcoming.length) throw Error("Prakiraan BMKG tidak tersedia");
          spatial_context = `Desa/kelurahan BMKG: ${clean(d.lokasi?.desa || "")} ${clean(d.lokasi?.kecamatan || "")}`;
          for (let i = 0; i < upcoming.length; i++) {
            const x = upcoming[i];
            add(
              "weather" + i,
              "weather",
              "Prakiraan kondisi cuaca BMKG",
              x.weather_desc,
              "",
              x.utc_datetime,
              "forecast",
              10800,
            );
            add(
              "temp" + i,
              "weather",
              "Prakiraan suhu BMKG",
              x.t,
              "°C",
              x.utc_datetime,
              "forecast",
              10800,
            );
            add(
              "humidity" + i,
              "weather",
              "Prakiraan kelembapan BMKG",
              x.hu,
              "%",
              x.utc_datetime,
              "forecast",
              10800,
            );
          }
        } else if (request.provider === "firms" || request.provider === "bmkg_quake") {
          const eventData = normalizeHazardEvents(request.provider, d, n, now, request.radius_km);
          events = eventData.events;
          event_coverage = eventData.coverage;
          spatial_context = `Dalam radius ${request.radius_km} km dari ${clean(n.name || n.id)}; ${event_coverage.feed}`;
          if (request.provider === "firms") {
            add(
              "hotspots",
              "fire",
              "Jumlah deteksi titik panas satelit 24 jam, bukan kebakaran terkonfirmasi",
              event_coverage.matched_count,
              "titik",
              null,
              "satellite",
              7200,
            );
            if (events[0]) {
              const x = events[0];
              add(
                "latest",
                "fire",
                "Titik panas satelit terbaru dalam hasil",
                `koordinat ${x.latitude}, ${x.longitude}; confidence ${x.confidence || "tidak tersedia"}; jarak ${x.distance_km.toFixed(1)} km`,
                "",
                x.observed_at,
                "satellite",
                7200,
                {
                  provider_coordinates: {
                    latitude: x.latitude,
                    longitude: x.longitude,
                    kind: "satellite_detection",
                  },
                  provider_location_known: true,
                  distance_km: x.distance_km,
                },
              );
            }
          } else {
            for (let i = 0; i < Math.min(events.length, 15); i++) {
              const x = events[i];
              add(
                "quake" + i,
                "earthquake",
                "Catatan BMKG dari daftar gempa M5+ sekitar lokasi",
                `${clean(x.title)}; magnitudo ${x.magnitude}; kedalaman ${x.depth_km ?? "tidak tersedia"} km; jarak sekitar ${x.distance_km.toFixed(0)} km; informasi potensi: ${clean(x.potential)}`,
                "",
                x.observed_at,
                "event",
                7200,
                {
                  provider_coordinates: {
                    latitude: x.latitude,
                    longitude: x.longitude,
                    kind: "epicenter",
                  },
                  provider_location_known: true,
                  distance_km: x.distance_km,
                },
              );
            }
            if (!events.length)
              add(
                "coverage",
                "earthquake",
                "Cakupan hasil gempa BMKG",
                `Tidak ada entri dalam radius ${request.radius_km} km pada daftar M5+ 7 hari terakhir yang diambil; ini tidak mencakup semua gempa`,
                "",
                null,
                "event",
                7200,
              );
          }
        } else throw Error("Provider tidak dikenal");
      } catch {
        error = "Data provider kosong atau skemanya tidak sesuai";
      }
    const ok = !error && facts.length > 0;
    entries.push({
      area_id: n.id,
      provider: request.provider,
      ok,
      request_latitude: n.latitude,
      request_longitude: n.longitude,
      payload: {
        reference,
        data_origin: "external_api",
        role: "supplementary",
        source: request.source,
        source_url: request.source_url,
        fetched_at,
        facts: ok ? facts : [],
        events: ok ? events : [],
        event_coverage,
        insights: summarizeEnvironment(ok ? facts : [], now).filter((i) => i.available),
        summary_method: "rules-v1",
        status: ok ? "available" : "unavailable",
      },
      refresh_after: new Date(now + (ok ? request.ttl : 3600) * 1000).toISOString(),
      last_error: ok ? null : error || "Tidak ada nilai yang tersedia untuk koordinat ini",
    });
  }
  return { json: { entries } };
}
return normalizeResponse($json, $("Rencanakan pengambilan API").item.json);

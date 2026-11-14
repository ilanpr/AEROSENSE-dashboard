// Shared by the API and the n8n Code node. No network calls or model tokens.
export function summarizeEnvironment(facts, now = Date.now()) {
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

export function orderEnvironmentFacts(facts, now = Date.now()) {
  const rank = (f) =>
    f.stale || !(Date.parse(f.fresh_until) > now)
      ? 3
      : f.kind === "forecast"
        ? 1
        : ["historical", "static_model", "event"].includes(f.kind)
          ? 2
          : 0;
  return [...facts].sort(
    (a, b) => rank(a) - rank(b) || (Date.parse(b.valid_at) || 0) - (Date.parse(a.valid_at) || 0),
  );
}

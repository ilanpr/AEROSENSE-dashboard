// Shared by the API and the n8n Code node. No network calls or model tokens.
export function summarizeEnvironment(facts, now = Date.now()) {
  const time = (f) => Date.parse(f.valid_at || f.fetched_at || "") || 0;
  const day = (t) => new Date(t + 7 * 3600000).toISOString().slice(0, 10);
  const fresh = facts.filter(
    (f) => !f.stale && Date.parse(f.fresh_until) > now,
  );
  const current = fresh
    .filter(
      (f) =>
        !["forecast", "historical", "event", "static_model"].includes(f.kind) &&
        (f.valid_at
          ? time(f) > 0 && time(f) <= now + 1800000
          : f.kind === "satellite"),
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
  function add(
    category,
    title,
    body,
    action,
    used = [],
    tone = "neutral",
    period = "current",
  ) {
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
  const today = fresh
    .filter(
      (f) => f.kind === "forecast" && f.valid_at && day(time(f)) === day(now),
    )
    .sort((a, b) => time(a) - time(b));
  const chance = match(today, "weather", /peluang presipitasi/i);
  if (rain && rain.value > 0)
    add(
      "weather",
      "Ada hujan dalam estimasi cuaca",
      "Model wilayah menunjukkan hujan pada interval terbaru.",
      "Siapkan payung sebelum keluar.",
      [rain, ...(temp ? [temp] : [])],
      "notice",
    );
  else if (temp)
    add(
      "weather",
      temp.value >= 32
        ? "Cuaca cenderung panas"
        : temp.value >= 26
          ? "Cuaca cenderung hangat"
          : "Cuaca cenderung sejuk",
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
      "Cuaca terbaru belum tersedia",
      "Kami belum punya data yang cukup baru untuk merangkum cuaca.",
      "Coba perbarui beberapa saat lagi.",
    );
  const aqi = match(current, "air_quality", /(AQI US|US AQI)/i);
  if (aqi && aqi.value >= 0) {
    const bands = [
      [
        50,
        "Kualitas udara diperkirakan baik",
        "Kategori baik menurut indeks US AQI wilayah.",
        "Tetap pilih rute yang jauh dari asap kendaraan.",
        "calm",
      ],
      [
        100,
        "Kualitas udara diperkirakan sedang",
        "Udara mungkin kurang nyaman bagi orang yang sangat sensitif.",
        "Perhatikan kenyamanan saat beraktivitas di luar.",
        "notice",
      ],
      [
        150,
        "Udara kurang sehat bagi kelompok sensitif",
        "Anak-anak, lansia, dan orang dengan gangguan pernapasan perlu lebih berhati-hati.",
        "Kurangi aktivitas berat di luar bila Anda sensitif.",
        "warning",
      ],
      [
        200,
        "Udara diperkirakan tidak sehat",
        "Polusi dapat berdampak pada lebih banyak orang.",
        "Kurangi aktivitas berat atau lama di luar ruang.",
        "warning",
      ],
      [
        300,
        "Udara diperkirakan sangat tidak sehat",
        "Tingkat polusi wilayah memerlukan perhatian lebih.",
        "Pindahkan kegiatan luar ruang ke dalam bila memungkinkan.",
        "danger",
      ],
      [
        Infinity,
        "Udara diperkirakan berbahaya",
        "Indeks polusi wilayah berada pada kategori tertinggi.",
        "Hindari aktivitas luar ruang dan ikuti arahan resmi.",
        "danger",
      ],
    ];
    const [, title, body, action, tone] = bands.find(
      ([max]) => aqi.value <= max,
    );
    add("air_quality", title, body, action, [aqi], tone);
  } else
    add(
      "air_quality",
      "Kondisi udara belum dapat disimpulkan",
      "Indeks kualitas udara terbaru belum tersedia.",
      "Rincian polutan yang tersedia tetap bisa dilihat.",
    );
  const soil = match(current, "soil", /kadar air tanah/i);
  const profile = fresh.filter((f) => f.category === "soil_profile");
  if (soil)
    add(
      "soil",
      "Kenali kondisi tanah permukaan",
      "Estimasi kadar air tanah tersedia untuk lapisan paling atas.",
      "Cek tanah langsung sebelum menentukan kebutuhan siram.",
      [soil],
      "calm",
    );
  else if (profile.length)
    add(
      "soil",
      "Profil tanah tersedia sebagai acuan",
      "Peta sifat tanah memberi gambaran umum, bukan kondisi tanah saat ini.",
      "Gunakan pengukuran setempat untuk keputusan perawatan.",
      profile.slice(0, 2),
      "neutral",
      "reference",
    );
  else
    add(
      "soil",
      "Tanah belum memiliki pembaruan",
      "Belum ada estimasi tanah terbaru untuk area ini.",
      "Cek kondisi tanah langsung bila diperlukan.",
    );
  const fire = match(current, "fire", /Jumlah titik panas/i);
  if (fire)
    add(
      "fire",
      fire.value > 0
        ? "Ada titik panas pada pantauan satelit"
        : "Tidak ada titik panas dalam hasil satelit",
      "Cakupan pantauan adalah feed 24 jam pada radius yang ditetapkan.",
      fire.value > 0
        ? "Cek lokasi dan informasi resmi. Titik panas belum tentu kebakaran."
        : "Hasil ini bukan jaminan tidak ada kebakaran.",
      [fire],
      fire.value > 0 ? "warning" : "neutral",
      "monitoring",
    );
  else
    add(
      "fire",
      "Pantauan titik panas belum tersedia",
      "Feed satelit untuk area ini belum diperbarui.",
      "Gunakan informasi resmi untuk memeriksa kejadian.",
    );
  const river = match(
    fresh
      .filter(
        (f) =>
          f.kind === "forecast" &&
          time(f) >= now &&
          time(f) <= now + 48 * 3600000,
      )
      .sort((a, b) => time(a) - time(b)),
    "flood",
    /debit sungai/i,
  );
  if (river)
    add(
      "flood",
      "Ada prakiraan aliran sungai",
      "Model memperkirakan debit sungai di grid sekitar wilayah.",
      "Lihat peringatan resmi untuk memastikan risiko banjir.",
      [river],
      "neutral",
      "forecast",
    );
  else
    add(
      "flood",
      "Prakiraan sungai belum tersedia",
      "Belum ada prakiraan debit untuk hari ini.",
      "Pantau informasi resmi bila hujan meningkat.",
    );
  const quakes = fresh.filter((f) => f.category === "earthquake");
  if (quakes.length)
    add(
      "earthquake",
      "Lihat catatan gempa dari BMKG",
      "Daftar ini memuat catatan M5+ yang tercakup di sekitar area.",
      "Buka rincian untuk waktu kejadian dan informasi resminya.",
      quakes.slice(0, 2),
      "neutral",
      "reference",
    );
  else
    add(
      "earthquake",
      "Catatan gempa belum diperbarui",
      "Data yang tersedia belum cukup baru untuk ditampilkan.",
      "Cek BMKG untuk informasi kejadian terkini.",
    );
  const species = fresh.filter((f) => f.category === "biodiversity");
  if (species.length)
    add(
      "biodiversity",
      "Kenali ragam hayati sekitar",
      "Ada catatan pengamatan spesies dari kawasan ini.",
      "Jelajahi catatannya; ini bukan pemantauan satwa saat ini.",
      species.slice(0, 3),
      "calm",
      "reference",
    );
  else
    add(
      "biodiversity",
      "Catatan hayati belum tersedia",
      "Belum ada catatan spesies yang sesuai area.",
      "Catatan pengamatan akan tampil saat sumber tersedia.",
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
    (a, b) =>
      rank(a) - rank(b) ||
      (Date.parse(b.valid_at) || 0) - (Date.parse(a.valid_at) || 0),
  );
}

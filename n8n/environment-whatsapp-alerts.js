function buildPublicApiAlerts(entries, now = Date.now()) {
  const alerts = [];
  const wibTime = (v) => {
    const t = Date.parse(v);
    return Number.isFinite(t)
      ? new Date(t).toLocaleString("id-ID", {
          timeZone: "Asia/Jakarta",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }) + " WIB"
      : "";
  };
  const bucket6h = Math.floor(now / (6 * 3600000));
  const bucket12h = Math.floor(now / (12 * 3600000));

  for (const entry of entries || []) {
    if (!entry?.ok || typeof entry.area_id !== "string" || !entry.area_id.startsWith("node_")) continue;
    const nodeId = entry.area_id.slice(5);
    if (!nodeId) continue;
    const payload = entry.payload || {};
    const areaName = String(payload.reference?.name || nodeId).slice(0, 80);
    const source = String(payload.source || entry.provider || "API publik");
    const facts = Array.isArray(payload.facts) ? payload.facts : [];
    const events = Array.isArray(payload.events) ? payload.events : [];
    const insights = Array.isArray(payload.insights) ? payload.insights : [];

    // 1. Kualitas udara wilayah (ISPU PM2.5 / US AQI warning atau danger)
    const airInsight = insights.find((i) => i.category === "air_quality" && ["warning", "danger"].includes(i.tone));
    if (airInsight) {
      const ispu = facts.find((f) => f.category === "air_quality" && /ISPU PM2\.5/i.test(f.label));
      const aqi = facts.find((f) => f.category === "air_quality" && /(AQI US|US AQI)/i.test(f.label));
      const detail = ispu
        ? `ISPU PM2.5: ${Math.round(ispu.value)}`
        : aqi
          ? `US AQI: ${Math.round(aqi.value)}`
          : "";
      const when = wibTime(airInsight.valid_at || payload.fetched_at);
      const dedupeKey = `pub_alert:${nodeId}:air:${airInsight.tone}:${bucket6h}`;
      alerts.push({
        node_id: nodeId,
        dedupe_key: dedupeKey,
        alert_id: dedupeKey,
        category: "air_quality",
        source,
        text:
          `Peringatan Udara Wilayah — ${areaName}\n` +
          `${airInsight.title}${detail ? ` (${detail})` : ""}. ${airInsight.body}\n` +
          `Saran: ${airInsight.action}\n` +
          `Sumber: ${source}${when ? ` (${when})` : ""}.\n` +
          `Ketik BERHENTI untuk berhenti menerima notifikasi.`,
      });
    }

    // 2. Cuaca ekstrem (hujan petir atau hujan lebat >= 20 mm & peluang >= 80%)
    const wxInsight = insights.find((i) => i.category === "weather" && ["warning", "danger"].includes(i.tone));
    const rainProb = facts.find((f) => f.category === "weather" && /peluang presipitasi/i.test(f.label) && Number.isFinite(f.value));
    const rainSum = facts.find((f) => f.category === "weather" && /total presipitasi/i.test(f.label) && Number.isFinite(f.value));
    if (wxInsight) {
      const when = wibTime(wxInsight.valid_at || payload.fetched_at);
      const dedupeKey = `pub_alert:${nodeId}:weather:thunder:${bucket6h}`;
      alerts.push({
        node_id: nodeId,
        dedupe_key: dedupeKey,
        alert_id: dedupeKey,
        category: "weather",
        source,
        text:
          `Peringatan Cuaca Wilayah — ${areaName}\n` +
          `${wxInsight.title}. ${wxInsight.body}\n` +
          `Saran: ${wxInsight.action}\n` +
          `Sumber: ${source}${when ? ` (${when})` : ""}.\n` +
          `Ketik BERHENTI untuk berhenti menerima notifikasi.`,
      });
    } else if (rainProb && rainSum && rainProb.value >= 80 && rainSum.value >= 20) {
      const when = wibTime(payload.fetched_at);
      const dedupeKey = `pub_alert:${nodeId}:weather:heavy_rain:${bucket6h}`;
      alerts.push({
        node_id: nodeId,
        dedupe_key: dedupeKey,
        alert_id: dedupeKey,
        category: "weather",
        source,
        text:
          `Peringatan Hujan Lebat — ${areaName}\n` +
          `Prakiraan hujan lebat hari ini (peluang ${Math.round(rainProb.value)}%, total sekitar ${rainSum.value.toFixed(1).replace(".", ",")} mm).\n` +
          `Saran: Siapkan payung atau jas hujan dan waspadai genangan di sekitar lokasi.\n` +
          `Sumber: ${source}${when ? ` (${when})` : ""}.\n` +
          `Ketik BERHENTI untuk berhenti menerima notifikasi.`,
      });
    }

    // 3. Titik panas satelit (FIRMS dalam radius 50 km)
    const fireInsight = insights.find((i) => i.category === "fire" && ["warning", "danger"].includes(i.tone));
    if (fireInsight) {
      const countFact = facts.find((f) => f.category === "fire" && /Jumlah (?:deteksi )?titik panas/i.test(f.label));
      const count = Number.isFinite(countFact?.value) ? Math.round(countFact.value) : 1;
      const when = wibTime(payload.fetched_at);
      const dedupeKey = `pub_alert:${nodeId}:fire:${bucket12h}`;
      alerts.push({
        node_id: nodeId,
        dedupe_key: dedupeKey,
        alert_id: dedupeKey,
        category: "fire",
        source,
        text:
          `Peringatan Titik Panas Satelit — ${areaName}\n` +
          `Terdeteksi ${count} titik panas satelit dalam radius 50 km (24 jam terakhir). Deteksi satelit belum mengonfirmasi kebakaran.\n` +
          `Saran: ${fireInsight.action}\n` +
          `Sumber: ${source}${when ? ` (${when})` : ""}.\n` +
          `Ketik BERHENTI untuk berhenti menerima notifikasi.`,
      });
    }

    // 4. Gempa BMKG M5+ terbaru (dalam 3 jam terakhir & radius 300 km)
    if (entry.provider === "bmkg_quake") {
      for (const ev of events) {
        const t = Date.parse(ev.observed_at);
        if (!Number.isFinite(t) || now - t > 3 * 3600000) continue;
        const when = wibTime(ev.observed_at);
        const mag = Number.isFinite(ev.magnitude) ? ev.magnitude.toFixed(1).replace(".", ",") : "";
        const dist = Number.isFinite(ev.distance_km) ? Math.round(ev.distance_km) : null;
        const dedupeKey = `pub_alert:${nodeId}:earthquake:${ev.id}`;
        alerts.push({
          node_id: nodeId,
          dedupe_key: dedupeKey,
          alert_id: dedupeKey,
          category: "earthquake",
          source,
          text:
            `Informasi Gempa BMKG — Sekitar ${areaName}\n` +
            `Gempa M ${mag} · ${ev.title}${dist !== null ? ` (jarak ~${dist} km)` : ""}.\n` +
            `${ev.potential ? `${ev.potential}. ` : ""}Ikuti arahan resmi BMKG dan BPBD setempat.\n` +
            `Waktu: ${when} · Sumber: ${source}.\n` +
            `Ketik BERHENTI untuk berhenti menerima notifikasi.`,
        });
      }
    }
  }
  return alerts;
}

const entries = $("Rapikan fakta dan sumber").item.json.entries || [];
const alerts = buildPublicApiAlerts(entries);
return { json: { alerts } };

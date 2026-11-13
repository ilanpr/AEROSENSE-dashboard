import type {
  EnvironmentFact,
  EnvironmentInsight,
  LiveNode,
  SensorRule,
} from "../types/live.types";
export type { SensorRule } from "../types/live.types";

export type Scene =
  | "sunny"
  | "sunny-morning"
  | "sunny-dusk"
  | "sunny-night"
  | "warm-night"
  | "partly-cloudy"
  | "cloudy"
  | "cloudy-night"
  | "fog"
  | "fog-night"
  | "drizzle"
  | "drizzle-night"
  | "light-rain"
  | "light-rain-night"
  | "steady-rain"
  | "rain-night"
  | "storm"
  | "storm-night"
  | "air"
  | "haze"
  | "soil"
  | "fire"
  | "flood"
  | "earthquake"
  | "sensor";
export type Highlight = { label: string; value: string; unit: string };

const number = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
const riverDay = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const weatherHour = new Intl.DateTimeFormat("id-ID", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: "Asia/Jakarta",
});
export const riverDayLabel = (at: string) => riverDay.format(new Date(at));

export function currentFacts(facts: EnvironmentFact[], now = Date.now()) {
  return facts
    .filter(
      (f) =>
        !f.stale &&
        Date.parse(f.fresh_until) > now &&
        !["forecast", "event", "historical", "static_model"].includes(f.kind) &&
        (f.valid_at
          ? Date.parse(f.valid_at) > 0 && Date.parse(f.valid_at) <= now + 1800000
          : f.kind === "satellite"),
    )
    .sort((a, b) => (Date.parse(b.valid_at || "") || 0) - (Date.parse(a.valid_at || "") || 0));
}

export function conditionScene(
  insight: EnvironmentInsight,
  facts: EnvironmentFact[],
  now = Date.now(),
): Scene {
  if (insight.category === "weather") {
    if (!insight.available) return "cloudy";
    const weather = currentFacts(facts, now).find(
      (f) => f.category === "weather" && /WMO|weather.?code/i.test(f.label),
    );
    const timestamp = Date.parse(weather?.valid_at || insight.valid_at || "");
    const hour = Number.isFinite(timestamp) ? Number(weatherHour.format(timestamp)) : NaN;
    const night = hour < 5 || hour >= 18;
    const code = weather?.value;
    if (typeof code === "number") {
      if ([95, 96, 97, 99].includes(code)) return night ? "storm-night" : "storm";
      if ([51, 53, 55, 56, 57].includes(code)) return night ? "drizzle-night" : "drizzle";
      if ([61, 66, 80].includes(code)) return night ? "light-rain-night" : "light-rain";
      if ([63, 65, 67, 81, 82].includes(code))
        return night ? "rain-night" : "steady-rain";
      if (code === 45 || code === 48) return night ? "fog-night" : "fog";
    }
    if (/petir/i.test(insight.title)) return night ? "storm-night" : "storm";
    if (/gerimis/i.test(insight.title)) return night ? "drizzle-night" : "drizzle";
    if (/hujan/i.test(insight.title)) return night ? "rain-night" : "steady-rain";
    if (/terasa hangat/i.test(insight.title)) return night ? "warm-night" : "sunny-dusk";
    if (!night && /terasa panas/i.test(insight.title)) return "sunny";
    if (code === 0 || code === 1 || code === 2) {
      if (night) return "sunny-night";
      if (hour < 11) return "sunny-morning";
      if (hour >= 17) return "sunny-dusk";
      return code === 0 ? "sunny" : "partly-cloudy";
    }
    return night ? "cloudy-night" : "cloudy";
  }
  if (insight.category === "air_quality") {
    return insight.available && ["notice", "warning", "danger"].includes(insight.tone)
      ? "haze"
      : "air";
  }
  return (
    ["soil", "fire", "flood", "earthquake"].includes(insight.category) ? insight.category : "cloudy"
  ) as Scene;
}

export function environmentHighlights(
  insight: EnvironmentInsight,
  facts: EnvironmentFact[],
  now = Date.now(),
): Highlight[] {
  if (!insight.available) return [];
  const fresh = currentFacts(facts, now).filter((f) => f.category === insight.category);
  const pm24h = /^Estimasi rata-rata PM2\.5 24 jam$/;
  const byCategory: Record<string, [RegExp, string][]> = {
    weather: [
      [/^Suhu udara$/i, "Suhu wilayah"],
      [/Kelembapan udara/i, "Kelembapan"],
      [/Kecepatan angin/i, "Angin"],
    ],
    air_quality: [
      [/^Estimasi ISPU PM2\.5 \(24 jam\)$/i, "Estimasi ISPU PM2.5"],
      fresh.some((f) => pm24h.test(f.label))
        ? [pm24h, "PM2.5 rata-rata 24 jam"]
        : [/^Estimasi PM2\.5 wilayah$/i, "PM2.5 wilayah"],
      [/AQI US|US AQI/i, "US AQI wilayah"],
    ],
    soil: [
      [/kadar air tanah/i, "Kelembapan tanah (0–1 cm)"],
      [/suhu tanah/i, "Suhu tanah"],
    ],
    fire: [[/Jumlah (?:deteksi )?titik panas/i, "Titik panas tercatat dalam 24 jam"]],
  };
  const picks = byCategory[insight.category] || [];
  if (insight.category === "flood") {
    const rivers = facts.filter(
      (f) =>
        insight.fact_ids.includes(f.id) &&
        f.kind === "forecast" &&
        !f.stale &&
        Date.parse(f.fresh_until) > now &&
        typeof f.value === "number",
    );
    return rivers.sort((a, b) => Date.parse(a.valid_at || "") - Date.parse(b.valid_at || "")).map((river) => ({
      label: river.valid_at ? `Debit · ${riverDayLabel(river.valid_at)} (UTC)` : "Prakiraan debit sungai",
      value: number(river.value as number),
      unit: river.unit,
    }));
  }
  return picks.flatMap(([pattern, label]) => {
    const f = fresh.find(
      (f) => pattern.test(f.label) && typeof f.value === "number" && Number.isFinite(f.value),
    );
    return f
      ? [
          {
            label,
            value: number((f.value as number) * (f.unit === "m³/m³" ? 100 : 1)),
            unit: f.unit === "m³/m³" ? "% volume" : f.unit,
          },
        ]
      : [];
  });
}

// TEMPORARY (Nov 2026): the gateway sends PM2.5 estimasi (pm25_ug_m3, Sharp nominal conversion) but not
// dust_ug_m3, so node status is judged on PM2.5 estimasi alone and the hero shows only that value.
// To go back to the full rule set (Debu optik + TVOC + validated PM2.5): set this to false, or revert the commit
// "TEMP: status from PM2.5 estimasi only". Keep the dust_ug_m3 rule enabled: WATERSENSE ESP-NOW uses it.
export const TEMP_STATUS_PM25_ONLY = true;

export function sensorSummary(
  node: LiveNode | undefined,
  rules: SensorRule[] = node?.rules || [],
  pm25Only: boolean = TEMP_STATUS_PM25_ONLY,
) {
  const pending = {
    label: "Data belum cukup",
    title: "Menunggu pembacaan.",
    body: "",
    tone: "pending",
  };
  const reading = node?.latest;
  if (!reading?.reading_id || reading.stale || reading.quality?.invalid === true) return pending;
  const configured = rules.filter(
    (r) =>
      r.enabled &&
      (pm25Only
        ? ["pm25_ug_m3"]
        : ["dust_ug_m3", "tvoc_ppb", ...(node?.pm25_validated ? ["pm25_ug_m3"] : [])]
      ).includes(r.metric),
  );
  const usable = configured.filter(
    (r) =>
      Number.isFinite(r.high) &&
      r.high > 0 &&
      Number.isFinite(r.clear_below) &&
      r.clear_below >= 0 &&
      r.clear_below < r.high &&
      typeof reading.metrics[r.metric] === "number" &&
      Number.isFinite(reading.metrics[r.metric]) &&
      Number(reading.metrics[r.metric]) >= 0,
  );
  const critical = usable.find(
    (r) =>
      typeof r.danger_high === "number" &&
      Number.isFinite(r.danger_high) &&
      r.danger_high > r.high &&
      Number(reading.metrics[r.metric]) >= r.danger_high,
  );
  if (critical)
    return {
      label: "Bahaya",
      title: "Udara tidak sehat.",
      body: "Kadar di titik ini melewati batas bahaya.",
      tone: "danger",
    };
  const raised = usable.find(
    (r) =>
      Number(reading.metrics[r.metric]) >= r.high ||
      (r.active && Number(reading.metrics[r.metric]) > r.clear_below),
  );
  if (raised)
    return {
      label: "Waspada",
      title: "Udara kurang sehat.",
      body: "Kadar di titik ini melewati batas waspada.",
      tone: "warning",
    };
  if (usable.length && usable.length === configured.length)
    return {
      label: "Terpantau baik",
      title: "Udara dalam batas baik.",
      body: "",
      tone: "calm",
    };
  return pending;
}

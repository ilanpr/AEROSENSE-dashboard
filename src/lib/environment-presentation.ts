import type {
  EnvironmentFact,
  EnvironmentInsight,
  LiveNode,
} from "../types/live.types";

export type Scene =
  | "sunny"
  | "cloudy"
  | "rain"
  | "storm"
  | "air"
  | "haze"
  | "soil"
  | "fire"
  | "flood"
  | "earthquake"
  | "biodiversity"
  | "sensor";
export type Highlight = { label: string; value: string; unit: string };
export type SensorRule = {
  metric: string;
  high: number;
  clear_below: number;
  enabled: boolean;
  active: boolean;
  unit: string;
};

const number = (n: number) =>
  n.toLocaleString("id-ID", { maximumFractionDigits: 2 });

export function currentFacts(facts: EnvironmentFact[], now = Date.now()) {
  return facts
    .filter(
      (f) =>
        !f.stale &&
        Date.parse(f.fresh_until) > now &&
        !["forecast", "event", "historical", "static_model"].includes(f.kind) &&
        (f.valid_at
          ? Date.parse(f.valid_at) > 0 &&
            Date.parse(f.valid_at) <= now + 1800000
          : f.kind === "satellite"),
    )
    .sort(
      (a, b) =>
        (Date.parse(b.valid_at || "") || 0) -
        (Date.parse(a.valid_at || "") || 0),
    );
}

export function conditionScene(
  insight: EnvironmentInsight,
  facts: EnvironmentFact[],
): Scene {
  if (insight.category === "weather") {
    if (!insight.available) return "cloudy";
    const current = currentFacts(facts).filter((f) => f.category === "weather");
    const code = current.find((f) => /WMO|weather.?code/i.test(f.label));
    if (typeof code?.value === "number") {
      if ([95, 96, 99].includes(code.value)) return "storm";
      if (
        [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(
          code.value,
        )
      )
        return "rain";
      if (code.value === 0) return "sunny";
    }
    if (/hujan/i.test(insight.title)) return "rain";
    return "cloudy";
  }
  if (insight.category === "air_quality")
    return ["warning", "danger", "notice"].includes(insight.tone)
      ? "haze"
      : "air";
  return (
    ["soil", "fire", "flood", "earthquake", "biodiversity"].includes(
      insight.category,
    )
      ? insight.category
      : "cloudy"
  ) as Scene;
}

export function environmentHighlights(
  insight: EnvironmentInsight,
  facts: EnvironmentFact[],
  now = Date.now(),
): Highlight[] {
  if (!insight.available) return [];
  const fresh = currentFacts(facts, now).filter(
    (f) => f.category === insight.category,
  );
  const byCategory: Record<string, [RegExp, string][]> = {
    weather: [
      [/^Suhu udara$/i, "Suhu wilayah"],
      [/Kelembapan udara/i, "Kelembapan"],
      [/Kecepatan angin/i, "Angin"],
    ],
    air_quality: [
      [/AQI US|US AQI/i, "US AQI wilayah"],
      [/PM2\.5/i, "PM2.5 wilayah"],
    ],
    soil: [
      [/kadar air tanah/i, "Air tanah permukaan"],
      [/suhu tanah/i, "Suhu tanah"],
    ],
    fire: [[/Jumlah titik panas/i, "Deteksi dalam feed 24 jam"]],
  };
  const picks = byCategory[insight.category] || [];
  if (insight.category === "flood") {
    const river = facts.find(
      (f) =>
        insight.fact_ids.includes(f.id) &&
        f.kind === "forecast" &&
        !f.stale &&
        Date.parse(f.fresh_until) > now &&
        typeof f.value === "number",
    );
    return river
      ? [
          {
            label: "Prakiraan debit sungai",
            value: number(river.value as number),
            unit: river.unit,
          },
        ]
      : [];
  }
  return picks.flatMap(([pattern, label]) => {
    const f = fresh.find(
      (f) =>
        pattern.test(f.label) &&
        typeof f.value === "number" &&
        Number.isFinite(f.value),
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

export function sensorSummary(
  node: LiveNode | undefined,
  rules: SensorRule[] = [],
) {
  const reading = node?.latest;
  if (!reading?.reading_id || reading.stale)
    return {
      title: "Menunggu pembacaan terbaru.",
      body: "Panel ini akan terisi saat node AEROSENSE mengirim data baru.",
      tone: "pending",
    };
  const usable = rules.filter(
    (r) =>
      r.enabled &&
      Number.isFinite(r.high) &&
      (r.metric !== "pm25_ug_m3" || node?.pm25_validated) &&
      typeof reading.metrics[r.metric] === "number" &&
      Number.isFinite(reading.metrics[r.metric]),
  );
  const raised = usable.find(
    (r) =>
      Number(reading.metrics[r.metric]) >= r.high ||
      (r.active && Number(reading.metrics[r.metric]) > r.clear_below),
  );
  if (raised)
    return {
      title: "Ada pembacaan yang perlu diperhatikan.",
      body: "Salah satu parameter masih memicu peringatan sesuai ambang node ini. Lihat detail sebelum melanjutkan aktivitas.",
      tone: "warning",
    };
  if (usable.length)
    return {
      title: "Parameter terpantau di bawah ambang.",
      body: "Parameter yang memiliki aturan aktif tidak sedang memicu peringatan. Pembacaan lain tetap bisa dilihat di detail.",
      tone: "calm",
    };
  return {
    title: "Pembacaan terbaru sudah masuk.",
    body: "Lihat kondisi di titik sensor Anda. Penilaian ambang tersedia setelah aturan peringatan diatur.",
    tone: "calm",
  };
}

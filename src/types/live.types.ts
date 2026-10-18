export interface SensorContext {
  node_id: string;
  name: string;
  reading_id: string | null;
  observed_at: string | null;
  received_at: string | null;
  metrics: Record<string, number | null>;
  gru: {
    target: string;
    value: number;
    model_version: string;
    horizon_seconds: number;
  } | null;
  quality: Record<string, unknown>;
  stale: boolean;
  pm25_validated: boolean;
}
export interface SensorRule {
  metric: string;
  high: number;
  danger_high?: number | null;
  clear_below: number;
  enabled: boolean;
  active: boolean;
  unit: string;
}
export interface LiveNode {
  id: string;
  name: string;
  location_id: string;
  latitude: number;
  longitude: number;
  gateway_id: string;
  pm25_validated: boolean;
  calibration_version: string | null;
  role: string;
  latest: SensorContext | null;
  rules?: SensorRule[];
}
export interface Reading {
  id: string;
  node_id: string;
  observed_at: string;
  metrics: Record<string, number | null>;
  raw_metrics?: Record<string, number | null>;
  gru: SensorContext["gru"];
  processing?: Record<string, unknown>;
}
export interface Alert {
  id: string;
  node_id: string;
  metric: string;
  value: number;
  threshold: number;
  unit: string;
  created_at: string;
  acknowledged_at: string | null;
}
export interface EnvironmentFact {
  id: string;
  area_id: string;
  category: string;
  label: string;
  value: number | string;
  unit: string;
  valid_at: string | null;
  fresh_until: string;
  stale: boolean;
  source: string;
  source_url: string;
  kind: string;
  spatial_context: string;
  data_origin: string;
}
export interface EnvironmentResponse {
  events?: EnvironmentEvent[];
  event_layers?: {provider:string;category:string;radius_km:number;available:boolean;last_attempt_at:string|null;last_error:string|null;event_count:number;truncated:boolean}[];
  facts: EnvironmentFact[];
  insights: EnvironmentInsight[];
  summary_method: string;
  area: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    coordinate_source: string;
  };
  providers: {
    provider: string;
    last_attempt_at: string | null;
    last_error: string | null;
    refresh_after: string | null;
    facts: EnvironmentFact[];
  }[];
  fetched_at: string;
}
export interface EnvironmentEvent {
  id:string;
  provider:string;
  category:"fire"|"earthquake";
  latitude:number;
  longitude:number;
  title:string;
  observed_at:string;
  fetched_at:string;
  fresh_until:string;
  stale:boolean;
  distance_km:number;
  source:string;
  source_url:string;
  coordinate_kind:string;
  confidence?:string|null;
  magnitude?:number;
  depth_km?:number|null;
  felt?:string|null;
  potential?:string|null;
}
export interface EnvironmentInsight {
  category: string;
  title: string;
  body: string;
  action: string;
  tone: string;
  period: string;
  available: boolean;
  fact_ids: string[];
  valid_at: string | null;
  fresh_until: string | null;
  method: string;
}
export const metricLabels: Record<string, [string, string]> = {
  dust_ug_m3: ["Debu optik", "µg/m³"],
  pm25_ug_m3: ["PM2.5 tervalidasi", "µg/m³"],
  eco2_ppm: ["eCO₂", "ppm"],
  tvoc_ppb: ["TVOC", "ppb"],
  temperature_c: ["Suhu", "°C"],
  humidity_pct: ["Kelembapan", "%"],
};
export const dateLabel = (v: string | null | undefined) =>
  v && Number.isFinite(Date.parse(v))
    ? new Date(v).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "medium",
        timeStyle: "short",
      }) + " WIB"
    : "Waktu belum tersedia";

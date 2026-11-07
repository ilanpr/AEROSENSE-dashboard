import type { GruResult } from "../types/live.types.ts";

export function gruEstimates(gru: GruResult | null | undefined): Record<string, number> {
  const values =
    gru?.task === "fault_detection"
      ? gru.estimates || {}
      : gru?.target
        ? { [gru.target]: gru.value }
        : {};
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
  );
}

export function gruChartValue(gru: GruResult | null, metric: string): number | null {
  return gru?.horizon_seconds === 0 ? (gruEstimates(gru)[metric] ?? null) : null;
}

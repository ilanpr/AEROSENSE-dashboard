import type { LiveNode } from "../types/live.types.ts";
import { sensorSummary } from "./environment-presentation.ts";

export interface GeoPoint { latitude: number; longitude: number; accuracy?: number }
export function validPoint(point: GeoPoint) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}
export function distanceKm(a: GeoPoint, b: GeoPoint) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) *
    Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function nearbyNodes(nodes: LiveNode[], point: GeoPoint | null, radiusKm: number) {
  if (!point || !validPoint(point) || !Number.isFinite(radiusKm) || radiusKm <= 0) return [];
  const priority: Record<string, number> = { danger: 0, warning: 1, pending: 2, calm: 3 };
  return nodes.filter(validPoint).map(node => ({ node, distance: distanceKm(point, node), status: sensorSummary(node) }))
    .filter(item => item.distance <= radiusKm)
    .sort((a, b) => priority[a.status.tone] - priority[b.status.tone] || a.distance - b.distance);
}
export const distanceLabel = (km: number) => km < 1
  ? `${Math.round(km * 1000).toLocaleString("id-ID")} m`
  : `${km.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`;

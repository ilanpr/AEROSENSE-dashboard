import { api } from "./api";
import type { Alert, LiveNode, Reading, SensorContext } from "@/types/live.types";
export const sensorService = {
  getAll: () => api.get<{ nodes: LiveNode[]; refreshed_at: string }>("/v1/dashboard"),
  getLatest: (id: string) =>
    api.get<{ data: SensorContext[] }>("/v1/latest?node_id=" + encodeURIComponent(id)),
  getReadings: (id: string) =>
    api.get<{ readings: Reading[] }>("/v1/history?node_id=" + encodeURIComponent(id)),
  getAlerts: (id: string) =>
    api.get<{ alerts: Alert[] }>("/v1/alerts?node_id=" + encodeURIComponent(id)),
};

import { CheckCircle2, TriangleAlert, OctagonAlert, Clock3 } from "lucide-react";
import { sensorSummary } from "@/lib/environment-presentation";
import type { LiveNode } from "@/types/live.types";

export function NodeStatus({ node }: { node: LiveNode }) {
  const status = sensorSummary(node);
  const Icon = status.tone === "calm" ? CheckCircle2 : status.tone === "warning" ? TriangleAlert : status.tone === "danger" ? OctagonAlert : Clock3;
  return <span className={`node-status status-${status.tone}`} title="Status pemantauan berdasarkan ambang sensor yang diatur; bukan AQI atau kategori kesehatan.">
    <Icon size={13} aria-hidden="true" />{status.label}
  </span>;
}

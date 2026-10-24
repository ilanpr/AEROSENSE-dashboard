import { dateLabel, metricLabels, type LiveNode } from "@/types/live.types";
import "@/styles/node-readings.css";

export function NodeReadings({ node }: { node: LiveNode }) {
  const fresh = !!node.latest?.reading_id && !node.latest.stale && node.latest.quality?.invalid !== true;
  const keys = [node.pm25_validated ? "pm25_ug_m3" : "dust_ug_m3", "eco2_ppm", "temperature_c"];
  return <div className="node-reading-block">
    <dl className="node-readings">
      {keys.map(key => {
        const value = fresh ? node.latest?.metrics[key] : null;
        return <div key={key}>
          <dt>{metricLabels[key][0]}</dt>
          <dd>{typeof value === "number" && Number.isFinite(value) && (key === "temperature_c" || value >= 0) ? value.toLocaleString("id-ID", { maximumFractionDigits: 1 }) : "—"}<small>{metricLabels[key][1]}</small></dd>
        </div>;
      })}
    </dl>
    <p className="node-reading-time">{fresh ? "Dibaca" : "Data terbaru belum tersedia · terakhir"} {dateLabel(node.latest?.observed_at)}</p>
  </div>;
}

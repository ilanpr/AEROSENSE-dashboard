import { dateLabel, metricLabels, type LiveNode } from "@/types/live.types";
import "@/styles/node-readings.css";

// PM2.5 estimasi (debu optik if not validated), temperature and humidity, the same as the home cards.
// An old reading still shows its last values, dimmed and labelled; an invalid one shows none.
export function NodeReadings({ node }: { node: LiveNode }) {
  const latest = node.latest;
  const usable = !!latest?.reading_id && latest.quality?.invalid !== true;
  const fresh = usable && !latest.stale;
  const keys = [node.pm25_validated ? "pm25_ug_m3" : "dust_ug_m3", "temperature_c", "humidity_pct"];
  return (
    <div className="node-reading-block">
      <dl className={"node-readings" + (usable && !fresh ? " is-stale" : "")}>
        {keys.map((key) => {
          const value = usable ? latest?.metrics[key] : null;
          return (
            <div key={key}>
              <dt>{metricLabels[key][0]}</dt>
              <dd>
                {typeof value === "number" &&
                Number.isFinite(value) &&
                (key === "temperature_c" || value >= 0)
                  ? value.toLocaleString("id-ID", { maximumFractionDigits: 1 })
                  : "—"}
                <small>{metricLabels[key][1]}</small>
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="node-reading-time">
        {fresh
          ? "Dibaca"
          : usable
            ? "Data lama · terakhir dibaca"
            : "Data terbaru belum tersedia · terakhir"}{" "}
        {dateLabel(latest?.observed_at)}
      </p>
    </div>
  );
}

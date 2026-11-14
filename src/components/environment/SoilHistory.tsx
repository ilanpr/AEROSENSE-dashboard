import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { dateLabel, type SoilHistoryPoint } from "@/types/live.types";

const tick = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  timeZone: "Asia/Jakarta",
});
const series = [
  { key: "moisture_pct", label: "Kelembapan tanah", unit: "% volume", color: "#08738a" },
  { key: "rain_mm", label: "Curah hujan per jam", unit: "mm", color: "#1758b5" },
];

export function SoilHistory({ history }: { history?: SoilHistoryPoint[] }) {
  const ready =
    history &&
    history.filter((point) => Number.isFinite(point.moisture_pct)).length > 1 &&
    history.some((point) => Number.isFinite(point.rain_mm));
  return (
    <section className="soil-history" aria-labelledby="soil-history-title">
      <h3 id="soil-history-title">Perubahan tanah dan hujan</h3>
      <p>
        Lihat kapan permukaan makin basah atau mulai mengering. Data ini memperkirakan kondisi
        lapisan 0–1 cm di sekitar titik acuan dan tidak menunjukkan risiko genangan di jalan tertentu.
      </p>
      {ready ? (
        <>
          <div className="soil-history-grid">
            {series.map(({ key, label, unit, color }) => (
              <div key={key} className="soil-history-chart">
                <h4>{label} <small>{unit}</small></h4>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={history} margin={{ right: 12, top: 9 }}>
                    <CartesianGrid vertical={false} stroke="#e4edf5" />
                    <XAxis dataKey="at" minTickGap={34} tick={{ fontSize: 11, fill: "#405b73" }}
                      tickFormatter={(at) => tick.format(new Date(at))} />
                    <YAxis width={32} tick={{ fontSize: 11, fill: "#405b73" }} domain={[0, "auto"]} />
                    <Tooltip labelFormatter={(at) => dateLabel(String(at))}
                      formatter={(value) => [`${Number(value).toLocaleString("id-ID", { maximumFractionDigits: 1 })} ${unit}`, label]} />
                    {key === "moisture_pct" ? (
                      <Line dataKey={key} stroke={color} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    ) : (
                      <Bar dataKey={key} fill={color} maxBarSize={10} isAnimationActive={false} />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
          <small>Data per jam · hingga 72 jam terakhir (WIB) · model Open-Meteo</small>
        </>
      ) : (
        <p>Tren belum tersedia. Grafik muncul setelah data kelembapan dan hujan diperbarui.</p>
      )}
    </section>
  );
}

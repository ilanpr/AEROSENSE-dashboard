import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
// simple: corrected reading only (guests and warga). Otherwise raw input and GRU are drawn too.
export default function ReadingChart({
  data,
  simple = false,
}: {
  simple?: boolean;
  data: {
    time: string;
    reading: number | null;
    raw: number | null;
    gru: number | null;
  }[];
}) {
  return (
    <div className="sensor-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="time" hide />
          <YAxis width={50} />
          <Tooltip />
          {!simple && <Legend />}
          <Line
            name={simple ? "Nilai terkoreksi" : "Pembacaan"}
            dataKey="reading"
            stroke="#086cfb"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          {!simple && <Line
            name="Input mentah"
            dataKey="raw"
            stroke="#537496"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />}
          {!simple && <Line
            name="GRU (horizon 0)"
            dataKey="gru"
            stroke="#168466"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

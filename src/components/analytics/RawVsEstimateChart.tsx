import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { mockTrendData24h, mockTrendData7d } from "@/lib/mock-data";

export function RawVsEstimateChart() {
  const [range, setRange] = useState<"24" | "7">("24");
  const activeData = range === "24" ? mockTrendData24h : mockTrendData7d;

  return (
    <article className="bg-white border border-[#e5eef8] rounded-[20px] shadow-sm p-5 sm:p-6 flex flex-col justify-between">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[1.6px] text-[#6fa0ca] mb-1">
              KOREKSI PARTIKULAT
            </p>
            <h2 className="text-base sm:text-lg font-black text-[#11223D]">
              PM2.5: mentah vs estimasi
            </h2>
            <p className="text-[10px] text-[#8c9db1] mt-0.5">
              Contoh perubahan pembacaan dalam {range === "24" ? "24 jam" : "7 hari"}
            </p>
          </div>

          <div
            className="inline-flex bg-[#e7f1fb] border border-[#dcebf9] rounded-xl p-1 gap-1 self-start sm:self-auto select-none"
            role="group"
            aria-label="Rentang grafik"
          >
            <button
              type="button"
              onClick={() => setRange("24")}
              className={`border-0 text-[10px] font-extrabold px-3 py-1.5 rounded-[9px] transition-all cursor-pointer ${
                range === "24"
                  ? "bg-white text-[#0872f2] shadow-[0_2px_7px_rgba(167,199,228,0.32)]"
                  : "text-[#7b8da5] hover:text-[#0872f2]"
              }`}
            >
              24 jam
            </button>
            <button
              type="button"
              onClick={() => setRange("7")}
              className={`border-0 text-[10px] font-extrabold px-3 py-1.5 rounded-[9px] transition-all cursor-pointer ${
                range === "7"
                  ? "bg-white text-[#0872f2] shadow-[0_2px_7px_rgba(167,199,228,0.32)]"
                  : "text-[#7b8da5] hover:text-[#0872f2]"
              }`}
            >
              7 hari
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-5 my-3 text-[10px] font-bold text-[#71849b]">
          <span className="flex items-center gap-1.5">
            <i className="w-4 h-1 rounded-full bg-[#b3c3d9] inline-block" />
            Pembacaan mentah
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-4 h-1 rounded-full bg-[#0875ff] inline-block" />
            Estimasi AI
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-4 h-1 rounded-full bg-[#f2b352] inline-block" />
            Batas perhatian (35 µg/m³)
          </span>
        </div>
      </div>

      <div className="h-[250px] w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={activeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#e9eff7" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#9cabba"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: "#e9eff7" }}
            />
            <YAxis
              stroke="#9cabba"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              domain={[0, 45]}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white/95 backdrop-blur-xs border border-[#dceef8] rounded-xl p-2.5 shadow-md text-xs">
                      <p className="font-extrabold text-[#11223D] mb-1">{label}</p>
                      <p className="text-[10px] text-[#71849b]">
                        Mentah:{" "}
                        <strong className="text-[#526783]">{payload[0]?.value} µg/m³</strong>
                      </p>
                      <p className="text-[10px] text-[#0877f5] font-semibold">
                        Estimasi GRU: <strong>{payload[1]?.value} µg/m³</strong>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine y={35} stroke="#f4bb68" strokeDasharray="5 5" strokeWidth={1.5} />
            <Line
              type="monotone"
              dataKey="raw"
              name="Mentah"
              stroke="#b7c8da"
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: "#b7c8da" }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="estimate"
              name="Estimasi AI"
              stroke="#0877f5"
              strokeWidth={3.5}
              dot={{ r: 3, fill: "#0877f5" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="border-t border-[#eef2f7] mt-3 pt-3 text-[10px] text-[#899aaa] leading-relaxed">
        Garis estimasi menunjukkan hasil koreksi sensitivitas silang terhadap suhu dan kelembapan.
        Angka di halaman ini adalah contoh visual.
      </p>
    </article>
  );
}

import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/constants";
import { Wind, ChevronRight } from "lucide-react";

export function AqiHeroCard() {
  const navigate = useNavigate();

  return (
    <article className="aqi-hero rounded-[22px] text-white relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 sm:p-[28px_36px] shadow-[0_16px_32px_rgba(22,134,240,0.18)]">
      <div className="absolute w-[340px] h-[340px] -right-[110px] -top-[140px] rounded-full border border-white/15 pointer-events-none" />
      <div className="absolute w-[260px] h-[260px] right-[30px] -bottom-[190px] rounded-full border border-white/15 pointer-events-none" />

      <div className="relative z-10 max-w-[420px] mb-6 sm:mb-0">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 border border-white/25 px-2.5 py-1 text-[8.5px] font-black tracking-[1.2px] uppercase">
          <Wind className="w-3 h-3" /> RINGKASAN KAWASAN
        </span>

        <h2 className="text-2xl sm:text-[32px] tracking-[-1.2px] leading-[1.15] font-black my-3">
          Udara hari ini
          <br />
          <em className="not-italic text-[#d8f2ff]">terpantau sedang.</em>
        </h2>

        <p className="text-xs leading-relaxed text-[#e7f6ff] mb-4 max-w-[320px]">
          Delapan dari sepuluh node dalam kondisi baik. Cek titik terdekat sebelum beraktivitas.
        </p>

        <button
          type="button"
          onClick={() => navigate(ROUTES.SENSOR_MAP)}
          className="border-0 bg-white text-[#076ceb] min-h-[36px] rounded-full px-4 text-xs font-black inline-flex items-center gap-2 shadow-[0_5px_14px_rgba(0,84,187,0.2)] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(0,84,187,0.3)] transition-all cursor-pointer"
        >
          Lihat peta sensor
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        className="hero-aqi self-center sm:self-auto"
        role="img"
        aria-label="Indeks kualitas udara rata-rata 52, kategori sedang"
      >
        <span className="hero-aqi-orbit orbit-one" />
        <span className="hero-aqi-orbit orbit-two" />
        <span className="hero-aqi-spark spark-one">✦</span>
        <span className="hero-aqi-spark spark-two">✦</span>

        <div className="hero-aqi-ring">
          <div className="hero-aqi-core">
            <span className="text-[10px] font-black tracking-[1.15px] uppercase">
              AQI RATA-RATA
            </span>
            <strong className="text-6xl sm:text-[68px] font-black tracking-[-4px] leading-none text-[#0569d8] my-1">
              52
            </strong>
            <small className="text-[#2083c8] text-xs font-extrabold">Sedang</small>
          </div>
        </div>

        <span className="hero-aqi-dot dot-one" />
        <span className="hero-aqi-dot dot-two" />
      </div>
    </article>
  );
}

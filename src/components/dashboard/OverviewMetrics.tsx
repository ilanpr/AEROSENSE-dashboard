import { Wind, LineChart, Map } from "lucide-react";

export function OverviewMetrics() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
      <article className="bg-white border border-[#e5eef8] rounded-[17px] shadow-sm min-h-[109px] p-4 flex items-start gap-3">
        <div className="w-[33px] h-[33px] shrink-0 rounded-[11px] bg-[#e7f1ff] text-[#0871fc] grid place-items-center">
          <Wind className="w-4 h-4" />
        </div>
        <div>
          <span className="block text-[11px] text-[#8192a7] font-semibold mb-1">
            Rata-rata PM2.5
          </span>
          <strong className="text-2xl font-black tracking-[-1px] text-[#11223D] leading-tight">
            18,4 <small className="text-[10px] text-[#8393a8] font-bold">µg/m³</small>
          </strong>
          <span className="block text-[10px] text-[#97a6b8] mt-2">
            <b className="text-[#25b98a] font-black">↓ 8,2%</b> dari kemarin
          </span>
        </div>
      </article>

      <article className="bg-white border border-[#e5eef8] rounded-[17px] shadow-sm min-h-[109px] p-4 flex items-start gap-3">
        <div className="w-[33px] h-[33px] shrink-0 rounded-[11px] bg-[#ddf7ff] text-[#0895c4] grid place-items-center">
          <LineChart className="w-4 h-4" />
        </div>
        <div>
          <span className="block text-[11px] text-[#8192a7] font-semibold mb-1">Estimasi eCO₂</span>
          <strong className="text-2xl font-black tracking-[-1px] text-[#11223D] leading-tight">
            612 <small className="text-[10px] text-[#8393a8] font-bold">ppm</small>
          </strong>
          <span className="block text-[10px] text-[#97a6b8] mt-2">Dalam rentang pantauan</span>
        </div>
      </article>

      <article className="bg-white border border-[#e5eef8] rounded-[17px] shadow-sm min-h-[109px] p-4 flex items-start gap-3">
        <div className="w-[33px] h-[33px] shrink-0 rounded-[11px] bg-[#ece9ff] text-[#7167de] grid place-items-center">
          <Map className="w-4 h-4" />
        </div>
        <div>
          <span className="block text-[11px] text-[#8192a7] font-semibold mb-1">Node aktif</span>
          <strong className="text-2xl font-black tracking-[-1px] text-[#11223D] leading-tight">
            10 <small className="text-[10px] text-[#8393a8] font-bold">/ 10</small>
          </strong>
          <span className="block text-[10px] text-[#97a6b8] mt-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#31c99a]" />
            Terhubung
          </span>
        </div>
      </article>
    </div>
  );
}

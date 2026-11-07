import { type PrototypeNodeInfo } from "@/lib/mock-data";
import { MapPin } from "lucide-react";

interface NodeDetailCardProps {
  node: PrototypeNodeInfo;
}

export function NodeDetailCard({ node }: NodeDetailCardProps) {
  const isGood = node.uiStatus === "baik";

  return (
    <aside
      className="bg-white border border-[#e5eef8] rounded-[20px] shadow-sm p-5 flex flex-col justify-between"
      aria-live="polite"
    >
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="w-[39px] h-[39px] bg-[#e6f3ff] rounded-[13px] text-[#0977f6] grid place-items-center">
            <MapPin className="w-5 h-5 stroke-[2]" />
          </div>
          <span className={`status-chip ${isGood ? "good" : "warn"}`}>
            {isGood ? "Baik" : "Perlu perhatian"}
          </span>
        </div>

        <p className="text-[9px] font-black uppercase tracking-[1.6px] text-[#6fa0ca] mb-1">
          DETAIL NODE
        </p>
        <h2 className="text-xl sm:text-[22px] font-black tracking-[-0.7px] text-[#11223D] leading-tight">
          {node.name}
        </h2>
        <p className="text-[10px] text-[#9baabd] font-medium mt-1 mb-5">{node.code} • Aktif</p>

        <div className="bg-[#edf7ff] border border-[#dceeff] rounded-[13px] p-3.5 mb-4">
          <span className="block text-[10px] text-[#7194b8] font-bold">Indeks kualitas udara</span>
          <strong className="block text-3xl sm:text-[34px] font-black text-[#086ef2] tracking-[-1px] leading-tight mt-1">
            {node.aqi} <small className="text-xs font-bold tracking-normal">AQI</small>
          </strong>
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-3.5">
          <div>
            <span className="block text-[9.5px] text-[#9aabba] font-medium mb-1">PM2.5</span>
            <strong className="block text-xs font-bold text-[#11223D]">
              {node.pm25.toString().replace(".", ",")} µg/m³
            </strong>
          </div>
          <div>
            <span className="block text-[9.5px] text-[#9aabba] font-medium mb-1">eCO₂</span>
            <strong className="block text-xs font-bold text-[#11223D]">{node.eco2} ppm</strong>
          </div>
          <div>
            <span className="block text-[9.5px] text-[#9aabba] font-medium mb-1">TVOC</span>
            <strong className="block text-xs font-bold text-[#11223D]">{node.tvoc} ppb</strong>
          </div>
          <div>
            <span className="block text-[9.5px] text-[#9aabba] font-medium mb-1">Suhu</span>
            <strong className="block text-xs font-bold text-[#11223D]">
              {node.temperature.toString().replace(".", ",")}°C
            </strong>
          </div>
        </div>
      </div>

      <div className="border-t border-[#ecf1f8] mt-5 pt-3.5 text-[9.5px] text-[#91a2b5] font-medium flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#35c796]" />
        Terakhir diperbarui {node.lastUpdate}
      </div>
    </aside>
  );
}

import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/constants";
import { ChevronRight } from "lucide-react";

export function RecentAlertsCard() {
  const navigate = useNavigate();

  return (
    <article className="bg-white border border-[#e5eef8] rounded-[20px] shadow-sm p-4 sm:p-[18px_17px_11px]">
      <div className="flex justify-between items-center gap-4 mb-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[1.6px] text-[#6fa0ca] mb-1">
            BUTUH PERHATIAN
          </p>
          <h2 className="text-sm font-black text-[#11223D]">Peringatan terbaru</h2>
        </div>
        <span className="bg-[#fff0e8] text-[#e9754b] px-2 py-1 rounded-lg text-[10px] font-black">
          2
        </span>
      </div>

      <div className="divide-y divide-[#eef2f7]">
        <div
          onClick={() => navigate(ROUTES.ALERTS)}
          className="flex items-center gap-3 py-2.5 hover:bg-[#fafcfe] transition-colors cursor-pointer rounded-lg px-1"
        >
          <span className="w-[26px] h-[26px] rounded-[9px] bg-[#fff0e9] text-[#ef7454] grid place-items-center text-xs font-black shrink-0">
            !
          </span>
          <div className="flex-1 min-w-0">
            <strong className="block text-xs font-bold text-[#11223D] truncate">
              PM2.5 meningkat
            </strong>
            <p className="text-[10px] text-[#9cabbc] mt-0.5 truncate">Sidayu • 09.25 WIB</p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-[#a7b5c5] shrink-0" />
        </div>

        <div
          onClick={() => navigate(ROUTES.ALERTS)}
          className="flex items-center gap-3 py-2.5 hover:bg-[#fafcfe] transition-colors cursor-pointer rounded-lg px-1"
        >
          <span className="w-[26px] h-[26px] rounded-[9px] bg-[#fff7df] text-[#dfa52d] grid place-items-center text-xs font-black shrink-0">
            !
          </span>
          <div className="flex-1 min-w-0">
            <strong className="block text-xs font-bold text-[#11223D] truncate">
              TVOC mendekati batas
            </strong>
            <p className="text-[10px] text-[#9cabbc] mt-0.5 truncate">Manyar • 08.50 WIB</p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-[#a7b5c5] shrink-0" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate(ROUTES.ALERTS)}
        className="w-full text-center text-[#086df0] text-[10px] font-extrabold flex items-center justify-center gap-1 pt-3 border-t border-[#eef2f7] hover:underline cursor-pointer"
      >
        Semua peringatan <ChevronRight className="w-3 h-3" />
      </button>
    </article>
  );
}

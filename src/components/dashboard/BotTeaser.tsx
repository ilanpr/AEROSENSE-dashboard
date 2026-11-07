import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/constants";
import { Sparkles } from "lucide-react";

export function BotTeaser() {
  const navigate = useNavigate();

  return (
    <article className="p-4 rounded-[17px] bg-gradient-to-br from-[#dff3ff] to-[#d8ecff] border border-[#cce9ff] flex items-start gap-3 relative overflow-hidden shadow-2xs">
      <div className="w-[33px] h-[33px] rounded-[11px] bg-white text-[#1587fd] grid place-items-center shrink-0 shadow-2xs">
        <Sparkles className="w-4 h-4" />
      </div>

      <div className="relative z-10">
        <strong className="block text-xs font-bold text-[#11223D]">
          Ingin tahu arti angkanya?
        </strong>
        <p className="text-[10px] text-[#597b9e] leading-relaxed my-1.5">
          AERO-BOT bantu jelaskan data udara dengan bahasa sehari-hari.
        </p>
        <button
          type="button"
          onClick={() => navigate(ROUTES.AEROBOT)}
          className="border-0 bg-[#0c78f1] hover:bg-[#005ed1] text-white rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold shadow-2xs transition-colors cursor-pointer"
        >
          Mulai percakapan
        </button>
      </div>
    </article>
  );
}

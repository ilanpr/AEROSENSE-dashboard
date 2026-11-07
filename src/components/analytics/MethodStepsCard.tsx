import { Sparkles } from "lucide-react";

export function MethodStepsCard() {
  return (
    <aside className="bg-white border border-[#e5eef8] rounded-[20px] shadow-sm p-6 flex flex-col justify-between">
      <div>
        <div className="w-10 h-10 rounded-[13px] bg-[#e5f3ff] text-[#0877f8] grid place-items-center mb-5">
          <Sparkles className="w-5 h-5" />
        </div>

        <p className="text-[9px] font-black uppercase tracking-[1.6px] text-[#6fa0ca] mb-1">
          CARA KERJANYA
        </p>
        <h2 className="text-lg font-black text-[#11223D] tracking-[-0.6px] mb-5">
          Dari sensor ke insight
        </h2>

        <div className="space-y-4 relative">
          <div className="flex items-start gap-3 relative pb-4">
            <span className="w-7 h-7 rounded-full bg-[#eaf5ff] text-[#127df4] grid place-items-center shrink-0 text-xs font-black">
              01
            </span>
            <div>
              <strong className="block text-xs font-bold text-[#11223D]">Node membaca udara</strong>
              <p className="text-[10px] text-[#8b9aac] leading-relaxed mt-1">
                PM2.5, eCO₂, TVOC, suhu, dan kelembapan dikirim ke gateway.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 relative pb-4">
            <span className="w-7 h-7 rounded-full bg-[#eaf5ff] text-[#127df4] grid place-items-center shrink-0 text-xs font-black">
              02
            </span>
            <div>
              <strong className="block text-xs font-bold text-[#11223D]">Data dibersihkan</strong>
              <p className="text-[10px] text-[#8b9aac] leading-relaxed mt-1">
                Gangguan sesaat dan data kosong ditangani sebelum analisis.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-[#eaf5ff] text-[#127df4] grid place-items-center shrink-0 text-xs font-black">
              03
            </span>
            <div>
              <strong className="block text-xs font-bold text-[#11223D]">
                GRU membuat estimasi
              </strong>
              <p className="text-[10px] text-[#8b9aac] leading-relaxed mt-1">
                Hasil ditampilkan bersama pembacaan mentah untuk transparansi.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#f3f9ff] text-[#69849e] rounded-xl p-3 text-[10px] leading-relaxed mt-4">
        Estimasi AI membantu interpretasi; keputusan resmi tetap memerlukan verifikasi sensor dan
        metode audit.
      </div>
    </aside>
  );
}

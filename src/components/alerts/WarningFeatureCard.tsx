import { useState } from "react";
import { useToast } from "@/components/shared/Toast";

export function WarningFeatureCard() {
  const [acked, setAcked] = useState(false);
  const { showToast } = useToast();

  const handleAck = () => {
    if (acked) return;
    setAcked(true);
    showToast("Peringatan ditandai sudah dibaca pada sesi ini.");
  };

  return (
    <article className="border border-[#f7d8bf] dark:border-amber-900/40 rounded-[20px] bg-gradient-to-br from-[#fff8f0] to-[#fffdfb] dark:from-amber-950/20 dark:to-slate-900/60 p-5 sm:p-6 shadow-sm transition-all">
      <div className="flex justify-between items-center text-[#af937d] dark:text-amber-300/80 text-[10px] font-bold mb-4">
        <span className="text-[#c77735] dark:text-amber-300 bg-[#ffebd8] dark:bg-amber-950/60 px-2.5 py-1 rounded-md text-[9px] font-black tracking-wider uppercase">
          PERLU PERHATIAN • SIDAYU
        </span>
        <span className="font-semibold">09.25 WIB</span>
      </div>

      <div className="flex gap-4 items-start mb-5">
        <span className="w-10 h-10 rounded-[13px] bg-[#ffdfbe] dark:bg-amber-900/50 text-[#df813c] dark:text-amber-300 grid place-items-center text-xl font-black shrink-0">
          !
        </span>
        <div className="space-y-2">
          <h2 className="text-lg sm:text-[19px] font-black text-slate-900 dark:text-white tracking-tight leading-snug">
            Partikel debu sedang meningkat
          </h2>
          <p className="text-xs text-[#8f8277] dark:text-slate-300 leading-relaxed">
            PM2.5 di Sidayu tercatat 32,4 µg/m³ pada contoh pembacaan terakhir. Anak-anak dan orang
            dengan masalah pernapasan sebaiknya membatasi aktivitas luar ruangan.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="border border-[#f8e0c8] dark:border-amber-900/50 rounded-full bg-white dark:bg-slate-800 text-[#ab7948] dark:text-amber-300 text-[11px] px-3 py-1 font-bold shadow-xs">
              Gunakan masker saat keluar
            </span>
            <span className="border border-[#f8e0c8] dark:border-amber-900/50 rounded-full bg-white dark:bg-slate-800 text-[#ab7948] dark:text-amber-300 text-[11px] px-3 py-1 font-bold shadow-xs">
              Tutup ventilasi jika debu terasa
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-[#f5e5d8] dark:border-amber-900/30 pt-3.5 flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          {acked ? "Sudah dibaca" : "Belum ditinjau"}
        </span>
        <button
          type="button"
          onClick={handleAck}
          disabled={acked}
          className="border border-[#f3d3b7] dark:border-amber-900/60 bg-white dark:bg-slate-800 hover:bg-[#ffedda] dark:hover:bg-amber-950/60 text-[#d27f3e] dark:text-amber-300 rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {acked ? "Sudah dibaca" : "Tandai sudah dibaca"}
        </button>
      </div>
    </article>
  );
}

import { useState } from "react";
import { useToast } from "@/components/shared/Toast";

export function AlertDetailCard() {
  const [acked, setAcked] = useState(false);
  const { showToast } = useToast();

  const handleAck = () => {
    if (acked) return;
    setAcked(true);
    showToast("Peringatan ditandai sudah dibaca pada sesi ini.");
  };

  return (
    <article className="card p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-black text-base grid place-items-center shrink-0">
          !
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
            MANYAR • 08.50 WIB
          </p>
          <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
            TVOC mendekati batas perhatian
          </h2>
        </div>
        <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Sedang dipantau
        </span>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
        Nilai TVOC contoh 221 ppb. Pantau perkembangan sebelum aktivitas di area terbuka berlangsung
        lama.
      </p>

      <div className="border-t border-slate-100 dark:border-slate-800 pt-3.5 flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          {acked ? "Sudah dibaca" : "Belum ditinjau"}
        </span>
        <button
          type="button"
          onClick={handleAck}
          disabled={acked}
          className="border border-sky-100 dark:border-sky-900/40 bg-sky-50/80 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 text-primary-600 dark:text-primary-400 rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {acked ? "Sudah dibaca" : "Tandai sudah dibaca"}
        </button>
      </div>
    </article>
  );
}

import { Link } from "react-router-dom";
import { Sparkles, ChevronRight } from "lucide-react";
import { ROUTES } from "@/lib/constants";

export function CommunityGuidanceCard() {
  return (
    <article className="card p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-primary-600 dark:text-primary-400 grid place-items-center mb-4">
        <Sparkles className="w-5 h-5" />
      </div>

      <p className="text-[10px] font-black uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-1">
        PANDUAN WARGA
      </p>
      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight mb-4">
        Langkah kecil, dampak besar.
      </h2>

      <ol className="space-y-3 pl-4 list-decimal text-xs text-slate-600 dark:text-slate-300 mb-6">
        <li className="leading-relaxed">
          <strong className="text-slate-900 dark:text-white">Cek lokasi terdekat.</strong> Lihat
          status node sebelum keluar rumah.
        </li>
        <li className="leading-relaxed">
          <strong className="text-slate-900 dark:text-white">Sesuaikan aktivitas.</strong> Batasi
          waktu di luar jika udara memburuk.
        </li>
        <li className="leading-relaxed">
          <strong className="text-slate-900 dark:text-white">Ikuti peringatan.</strong> Gunakan
          tindakan yang disarankan sesuai kondisi.
        </li>
      </ol>

      <Link
        to={ROUTES.AEROBOT}
        className="w-full inline-flex items-center justify-between px-4 py-2.5 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/70 hover:bg-sky-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-primary-600 dark:text-primary-400 text-xs font-bold transition-colors"
      >
        <span>Tanyakan pada AERO-BOT</span>
        <ChevronRight className="w-4 h-4 ml-2" />
      </Link>
    </article>
  );
}

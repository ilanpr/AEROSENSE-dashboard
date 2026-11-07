import { Bell } from "lucide-react";

export function NotificationChannelsCard() {
  return (
    <article className="card p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-1">
        KANAL PEMBERITAHUAN
      </p>
      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight mb-4">
        Pesan yang menjangkau warga
      </h2>

      <div className="flex items-center gap-3 py-3 border-y border-slate-100 dark:border-slate-800">
        <span className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-primary-600 dark:text-primary-400 grid place-items-center shrink-0">
          <Bell className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <strong className="block text-xs font-bold text-slate-900 dark:text-white">
            Telegram & WhatsApp
          </strong>
          <small className="block text-[11px] text-slate-500 dark:text-slate-400">
            Rencana integrasi notifikasi
          </small>
        </div>
        <span className="shrink-0 text-[9px] font-black tracking-wider text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/60 px-2 py-1 rounded-md uppercase">
          DIRANCANG
        </span>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-4">
        Contoh ini memperlihatkan isi dan alur peringatan. Pengiriman otomatis belum aktif.
      </p>
    </article>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/constants";
import { ArrowRight, Lock, Mail, User } from "lucide-react";
import { authService } from "@/services/auth.service";

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      if (await authService.register(name, email, password))
        navigate(ROUTES.DASHBOARD);
      else
        setNotice("Periksa email Anda untuk mengonfirmasi akun sebelum masuk.");
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Pendaftaran belum berhasil.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f2f8fc] via-[#e8f3fc] to-[#deeeff] dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-3xl p-7 sm:p-8 shadow-xl">
          {/* Logo / Mascot */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-4">
              <img
                src="/assets/brand/aerosense-mark.png"
                alt="AEROSENSE"
                width="48"
                height="48"
                className="w-12 h-12 object-contain"
              />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Buat Akun <span className="text-primary-600">AEROSENSE</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs">
              Mulai memantau kualitas udara lingkungan Anda dengan visualisasi
              modern.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {notice && (
              <p className="live-notice" role="status">
                {notice}
              </p>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Nama Lengkap
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Nama Anda"
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="nama@perusahaan.com"
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Minimal 8 karakter"
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs shadow-md shadow-primary-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Daftar Akun</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sudah memiliki akun?{" "}
              <Link
                to={ROUTES.LOGIN}
                className="font-bold text-primary-600 hover:underline"
              >
                Masuk di sini
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

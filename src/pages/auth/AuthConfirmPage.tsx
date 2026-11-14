import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { ROUTES } from "@/lib/constants";
import { getSupabase } from "@/services/supabase";
import { apiRequest } from "@/services/api";

type Me = { profile?: { full_name?: string | null }; role_request?: { requested_role: string; status: string } | null };
const ROLE_LABEL: Record<string, string> = {
  operator: "Pengelola kawasan",
  auditor: "Auditor / peneliti",
  admin: "Admin lokasi",
};

// Landing page of the confirmation link. Supabase puts the session (or an error) in the URL.
export function AuthConfirmPage() {
  const [state, setState] = useState<"checking" | "ok" | "error">("checking");
  const [message, setMessage] = useState("");
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const error = hash.get("error_description") || query.get("error_description");
    if (error) {
      setMessage(
        /expired|invalid/i.test(error)
          ? "Tautan konfirmasi sudah kedaluwarsa atau sudah dipakai. Coba masuk; bila belum bisa, daftar ulang untuk menerima tautan baru."
          : error,
      );
      setState("error");
      return;
    }
    (async () => {
      const client = await getSupabase();
      const code = query.get("code");
      if (code) await client.auth.exchangeCodeForSession(code);
      const { data } = await client.auth.getSession();
      if (!data.session) throw new Error("Email sudah dikonfirmasi. Silakan masuk dengan email dan kata sandi Anda.");
      window.history.replaceState(null, "", "/auth/confirm");
      setState("ok");
      // First signed-in visit stores the sign-up profile and any role request.
      setMe(await apiRequest<Me>("/v1/me").catch(() => null));
    })().catch((e) => {
      setMessage(e instanceof Error ? e.message : "Konfirmasi belum berhasil.");
      setState("error");
    });
  }, []);

  const request = me?.role_request?.status === "pending" ? me.role_request : null;
  return (
    <div className="confirm-page">
      <main className="confirm-card" aria-live="polite">
        <Link to={ROUTES.HOME} className="login-brand confirm-brand" aria-label="AEROSENSE — Beranda">
          <img src="/assets/brand/aerosense-mark.png" className="login-brand-icon" width="40" height="40" alt="" />
          <span>
            AERO<strong>SENSE</strong>
          </span>
        </Link>
        {state === "checking" ? (
          <>
            <Loader2 className="confirm-icon spin" size={40} aria-hidden="true" />
            <h1>Memeriksa tautan…</h1>
          </>
        ) : state === "ok" ? (
          <>
            <CircleCheck className="confirm-icon ok" size={44} aria-hidden="true" />
            <h1>Email terkonfirmasi</h1>
            <p>
              {me?.profile?.full_name ? `Selamat datang, ${me.profile.full_name}. ` : "Selamat datang. "}
              Akun Anda sudah aktif dan Anda sudah masuk.
            </p>
            {request && (
              <p className="confirm-note">
                Permintaan peran <strong>{ROLE_LABEL[request.requested_role] || request.requested_role}</strong>{" "}
                sedang diverifikasi tim AEROSENSE. Sementara itu akun Anda aktif sebagai warga.
              </p>
            )}
            <p className="confirm-sub">
              Sebagai warga, Anda dapat melihat semua node publik, Hub Lingkungan, dan berlangganan peringatan
              WhatsApp.
            </p>
            <div className="confirm-actions">
              <Link to={ROUTES.DASHBOARD} className="login-submit">
                Lihat kondisi udara <ArrowRight size={18} />
              </Link>
              <Link to={ROUTES.ENVIRONMENT} className="confirm-secondary">
                Buka Hub Lingkungan
              </Link>
            </div>
          </>
        ) : (
          <>
            <CircleAlert className="confirm-icon bad" size={44} aria-hidden="true" />
            <h1>Konfirmasi belum berhasil</h1>
            <p>{message}</p>
            <div className="confirm-actions">
              <Link to={ROUTES.LOGIN} className="login-submit">
                Masuk <ArrowRight size={18} />
              </Link>
              <Link to={ROUTES.REGISTER} className="confirm-secondary">
                Daftar ulang
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLiveData } from "@/hooks/useLiveData";

type Me = { role_request?: { id: string; requested_role: string; status: string; review_note?: string | null } | null };
const ROLE_LABEL: Record<string, string> = {
  operator: "Pengelola kawasan",
  auditor: "Auditor / peneliti",
  admin: "Admin lokasi",
};

// Tells a new account where its role request stands. Shown once per request status.
export function RoleRequestDialog() {
  const { user } = useAuth();
  const me = useLiveData<Me>(user ? "/v1/me" : null, 300000);
  const ref = useRef<HTMLDialogElement>(null);
  const r = me.data?.role_request;
  const key = r ? "aerosense-role-" + r.id + "-" + r.status : "";
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    if (!key || r?.status === "cancelled") return;
    try {
      setSeen(localStorage.getItem(key) === "1");
    } catch {
      setSeen(false);
    }
  }, [key, r?.status]);
  useEffect(() => {
    if (key && !seen && !ref.current?.open) ref.current?.showModal();
  }, [key, seen]);
  if (!r || !key) return null;
  const close = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* private mode: show again next time */
    }
    ref.current?.close();
    setSeen(true);
  };
  const label = ROLE_LABEL[r.requested_role] || r.requested_role;
  return (
    <dialog ref={ref} className="role-dialog" aria-labelledby="role-dialog-title" onCancel={close}>
      {r.status === "pending" ? (
        <>
          <h2 id="role-dialog-title">Peran {label} sedang diverifikasi</h2>
          <p>
            Tim AEROSENSE akan memeriksa data Anda dan dapat menghubungi lewat email atau telepon yang Anda
            daftarkan. Sementara itu akun Anda aktif sebagai <strong>warga</strong>.
          </p>
          <ul>
            <li>Melihat kondisi udara dan semua node publik, di sekitar Anda maupun di tempat lain.</li>
            <li>Membuka Hub Lingkungan dan bertanya kepada AERO-BOT.</li>
            <li>Berlangganan peringatan WhatsApp untuk node publik.</li>
          </ul>
        </>
      ) : r.status === "approved" ? (
        <>
          <h2 id="role-dialog-title">Peran {label} disetujui</h2>
          <p>Menu pengelolaan sesuai peran Anda sudah aktif.</p>
        </>
      ) : (
        <>
          <h2 id="role-dialog-title">Permintaan peran {label} belum disetujui</h2>
          <p>{r.review_note || "Akun Anda tetap aktif sebagai warga."}</p>
        </>
      )}
      <button type="button" className="live-button" onClick={close} autoFocus>
        Mengerti
      </button>
    </dialog>
  );
}

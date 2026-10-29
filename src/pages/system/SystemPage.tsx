import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DataState } from "@/components/shared/DataState";
import { WhatsAppSettings } from "@/components/live/WhatsAppSettings";
export function SystemPage() {
  const auth = useAuth(),
    navigate = useNavigate();
  const [notice, setNotice] = useState("");
  return (
    <div className="space-y-6">
      <header className="live-heading">
        <div>
          <h1>Pengaturan</h1>
          <p>Akun, ambang peringatan, dan langganan WhatsApp.</p>
        </div>
      </header>
      {!auth.user ? (
        <DataState
          error={auth.error || "Masuk untuk mengatur akun dan perangkat."}
        />
      ) : (
        <>
          <section className="live-panel">
            <h2>Akun</h2>
            <p>{auth.user.email}</p>
            <button
              className="live-button secondary"
              onClick={async () => {
                try {
                  await auth.logout();
                  navigate("/login");
                } catch (e) {
                  setNotice(e instanceof Error ? e.message : "Gagal keluar.");
                }
              }}
            >
              Keluar akun
            </button>
          </section>
          <section className="live-panel">
            <h2>Ambang kawasan</h2>
            <p>Kelola batas waspada, bahaya, dan notifikasi pada perangkat di lokasi yang ditugaskan.</p>
            <Link className="live-button secondary" to="/management">Buka pengelolaan kawasan</Link>
          </section>
          <WhatsAppSettings />
        </>
      )}
      {notice && (
        <p className="live-notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/constants";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { authService } from "@/services/auth.service";
import { DEMO_MODE } from "@/lib/demo-mode";
import { DEMO_ACCOUNTS } from "@/demo/session";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await authService.login(email, password);
      navigate(ROUTES.DASHBOARD);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login belum berhasil.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-story">
        <Link to={ROUTES.DASHBOARD} className="login-brand" aria-label="AEROSENSE — Beranda">
          <img src="/assets/brand/aerosense-mark.png" className="login-brand-icon" width="40" height="40" alt="" />
          <span>AERO<strong>SENSE</strong></span>
        </Link>
        <div className="login-story-copy">
          <span className="login-location"><span /> Surabaya · Indonesia</span>
          <h1>Kenali udara<br />di sekitar Anda.</h1>
          <p>Kondisi node, cuaca, dan lingkungan.<br />Langsung dari satu tempat.</p>
          <Link to={ROUTES.DASHBOARD} className="guest-entry">Lihat kondisi sekarang <ArrowRight size={19} /></Link>
        </div>
        <img className="login-scene" src="/assets/aerobot/falcon/calm.webp" alt="Maskot AERO-BOT" />
        <span className="login-story-footer">{DEMO_MODE ? "Surabaya · Data simulasi" : "AEROSENSE · Pemantauan lingkungan"}</span>
      </section>
      <section className="login-form-panel" aria-labelledby="login-heading">
        <div className="login-form-inner">
          <Link to={ROUTES.DASHBOARD} className="login-back">← Kembali ke pemantauan</Link>
          <h2 id="login-heading">Masuk ke akun</h2>
          <p className="login-caption">Kelola perangkat dan tindak lanjut peringatan.</p>
          <form onSubmit={handleSubmit}>
            {DEMO_MODE && <div className="demo-login">
              <strong>Pilih akses</strong>
              <div>{DEMO_ACCOUNTS.map(a => <button type="button" key={a.role} onClick={()=>{setEmail(a.email);setPassword(a.password);setError("");}}>Akun {a.label.toLowerCase()} <ArrowRight size={14} /></button>)}</div>
            </div>}
            {error && <p className="live-notice" role="alert">{error}</p>}
            <label htmlFor="login-email">Email</label>
            <div className="login-input"><Mail size={18} /><input id="login-email" autoComplete="username" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="nama@email.com" /></div>
            <label htmlFor="login-password">Kata sandi</label>
            <div className="login-input"><Lock size={18} /><input id="login-password" autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Kata sandi Anda" /></div>
            <button type="submit" className="login-submit" disabled={busy}>{busy ? "Memeriksa akun…" : "Masuk"}<ArrowRight size={18} /></button>
          </form>
          <p className="login-register">Belum punya akun? <Link to={ROUTES.REGISTER}>Daftar</Link></p>
          <Link to={ROUTES.DASHBOARD} className="login-guest">Lanjut sebagai tamu <ArrowRight size={16} /></Link>
        </div>
      </section>
    </div>
  );
}

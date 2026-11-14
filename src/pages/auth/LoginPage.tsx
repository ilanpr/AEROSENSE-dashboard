import { AuthStory } from "./AuthStory";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ROUTES } from "@/lib/constants";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { authService } from "@/services/auth.service";
import { DEMO_MODE } from "@/lib/demo-mode";
import { DEMO_ACCOUNTS } from "@/demo/session";

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
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
      navigate(params.get("next") === "/robot-screen" ? "/robot-screen" : ROUTES.DASHBOARD);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login belum berhasil.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <AuthStory />
      <section className="login-form-panel" aria-labelledby="login-heading">
        <div className="login-form-inner">
          <h1 id="login-heading">Masuk</h1>
          <form onSubmit={handleSubmit}>
            {DEMO_MODE && (
              <div className="demo-login">
                <strong>Pilih akses</strong>
                <div>
                  {DEMO_ACCOUNTS.map((a) => (
                    <button
                      type="button"
                      key={a.role}
                      onClick={() => {
                        setEmail(a.email);
                        setPassword(a.password);
                        setError("");
                      }}
                    >
                      {a.label} <ArrowRight size={14} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error && (
              <p className="live-notice" role="alert">
                {error}
              </p>
            )}
            <label htmlFor="login-email">Email</label>
            <div className="login-input">
              <Mail size={18} />
              <input
                id="login-email"
                autoComplete="username"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="nama@email.com"
              />
            </div>
            <label htmlFor="login-password">Kata sandi</label>
            <div className="login-input">
              <Lock size={18} />
              <input
                id="login-password"
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Kata sandi Anda"
              />
            </div>
            <button type="submit" className="login-submit" disabled={busy}>
              {busy ? "Sedang masuk…" : "Masuk"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="login-register">
            Belum punya akun? <Link to={ROUTES.REGISTER}>Daftar</Link>
          </p>
          <Link to={ROUTES.DASHBOARD} className="login-guest">
            Lihat pemantauan <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}

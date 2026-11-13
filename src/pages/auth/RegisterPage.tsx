import { AuthStory } from "./AuthStory";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Lock, Mail, MapPin, Phone, Search, User } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ROUTES } from "@/lib/constants";
import { authService, type SignUpProfile } from "@/services/auth.service";
import { apiRequest } from "@/services/api";
import { DEMO_MODE } from "@/lib/demo-mode";

type Place = { label: string; latitude: number; longitude: number };
const SURABAYA: [number, number] = [-7.2575, 112.7521];
const ROLES = [
  { value: "", label: "Warga", hint: "Melihat kondisi udara, node publik, dan menerima peringatan." },
  { value: "operator", label: "Pengelola kawasan", hint: "Mengatur ambang dan WATERSENSE di lokasi Anda." },
  { value: "auditor", label: "Auditor / peneliti", hint: "Membaca laporan lingkungan dan detail model." },
  { value: "admin", label: "Admin lokasi", hint: "Penanggung jawab lokasi dan perangkat." },
] as const;

function Recenter({ point }: { point: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(point, 15);
  }, [map, point]);
  return null;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    organization: "",
    phone: "",
    address: "",
    requested_role: "",
    note: "",
  });
  const [point, setPoint] = useState<[number, number] | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const role = ROLES.find((r) => r.value === form.requested_role)!;

  async function searchAddress() {
    if (form.address.trim().length < 3) return setNotice("Ketik minimal 3 huruf alamat.");
    setSearching(true);
    setNotice("");
    try {
      const { results } = await apiRequest<{ results: Place[] }>(
        "/v1/geocode?q=" + encodeURIComponent(form.address),
        {},
        false,
      );
      setPlaces(results);
      if (results[0]) setPoint([results[0].latitude, results[0].longitude]);
      else setNotice("Alamat belum ditemukan. Coba nama jalan dan kota, atau lewati bagian ini.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Pencarian alamat belum berhasil.");
    } finally {
      setSearching(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    const profile: SignUpProfile = {
      organization: form.organization.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      ...(point ? { latitude: point[0], longitude: point[1] } : {}),
      ...(form.requested_role
        ? { requested_role: form.requested_role as SignUpProfile["requested_role"], note: form.note.trim() || undefined }
        : {}),
    };
    try {
      if (await authService.register(form.name.trim(), form.email.trim(), form.password, profile))
        navigate(ROUTES.DASHBOARD);
      else setSentTo(form.email.trim());
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Pendaftaran belum berhasil.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <AuthStory />

      <section className="login-form-panel" aria-labelledby="register-heading">
        <div className="login-form-inner register-inner">
          <Link to={ROUTES.LOGIN} className="login-back">
            Sudah punya akun? Masuk
          </Link>
          {sentTo ? (
            <div className="register-sent" role="status">
              <Mail size={28} aria-hidden="true" />
              <h1 id="register-heading">Periksa email Anda</h1>
              <p>
                Kami mengirim tautan konfirmasi ke <strong>{sentTo}</strong>. Buka tautan itu untuk mengaktifkan
                akun. Tidak ada di kotak masuk? Periksa folder spam.
              </p>
              {form.requested_role && (
                <p>
                  Permintaan peran <strong>{role.label}</strong> akan diverifikasi tim AEROSENSE setelah email
                  terkonfirmasi. Sampai disetujui, akun Anda aktif sebagai warga.
                </p>
              )}
              <Link to={ROUTES.DASHBOARD} className="login-submit">
                Lihat kondisi udara sekarang <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <>
              <h1 id="register-heading">Buat akun</h1>
              <form onSubmit={submit} className="register-form">
                {notice && (
                  <p className="live-notice" role="alert">
                    {notice}
                  </p>
                )}
                <fieldset>
                  <legend>Akun</legend>
                  <label htmlFor="reg-name">Nama lengkap</label>
                  <div className="login-input">
                    <User size={18} />
                    <input id="reg-name" autoComplete="name" required minLength={2} maxLength={80}
                      value={form.name} onChange={set("name")} placeholder="Nama Anda" />
                  </div>
                  <label htmlFor="reg-email">Email</label>
                  <div className="login-input">
                    <Mail size={18} />
                    <input id="reg-email" type="email" autoComplete="email" required
                      value={form.email} onChange={set("email")} placeholder="nama@email.com" />
                  </div>
                  <label htmlFor="reg-password">Kata sandi</label>
                  <div className="login-input">
                    <Lock size={18} />
                    <input id="reg-password" type="password" autoComplete="new-password" required minLength={8}
                      value={form.password} onChange={set("password")} placeholder="Minimal 8 karakter" />
                  </div>
                </fieldset>

                <fieldset>
                  <legend>
                    Profil <span>opsional</span>
                  </legend>
                  <label htmlFor="reg-org">Instansi atau organisasi</label>
                  <div className="login-input">
                    <Building2 size={18} />
                    <input id="reg-org" autoComplete="organization" maxLength={120}
                      value={form.organization} onChange={set("organization")} placeholder="Contoh: Kelurahan Keputih" />
                  </div>
                  <label htmlFor="reg-phone">Nomor telepon</label>
                  <div className="login-input">
                    <Phone size={18} />
                    <input id="reg-phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={20}
                      value={form.phone} onChange={set("phone")} placeholder="0812 3456 7890" />
                  </div>
                  <label htmlFor="reg-address">Alamat</label>
                  <div className="register-address">
                    <div className="login-input">
                      <MapPin size={18} />
                      <input id="reg-address" autoComplete="street-address" maxLength={240}
                        value={form.address}
                        onChange={(e) => {
                          set("address")(e);
                          setPlaces([]);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void searchAddress();
                          }
                        }}
                        placeholder="Jalan, kelurahan, kota" />
                    </div>
                    <button type="button" className="register-search" onClick={searchAddress} disabled={searching}>
                      <Search size={16} /> {searching ? "Mencari…" : "Cari"}
                    </button>
                  </div>
                  {places.length > 1 && (
                    <ul className="register-places" aria-label="Pilihan alamat">
                      {places.map((p) => (
                        <li key={p.label}>
                          <button type="button" onClick={() => setPoint([p.latitude, p.longitude])}>
                            {p.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="register-map">
                    <MapContainer center={point || SURABAYA} zoom={point ? 15 : 11} className="h-full w-full"
                      scrollWheelZoom={false}>
                      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution="&copy; OpenStreetMap" />
                      {point && (
                        <>
                          <Recenter point={point} />
                          <CircleMarker center={point} radius={9} pathOptions={{ color: "#0a63e8", fillOpacity: 0.6 }} />
                        </>
                      )}
                    </MapContainer>
                  </div>
                  <p className="register-hint">
                    Alamat hanya untuk mengarahkan peta ke sekitar Anda. Anda tetap bisa melihat kondisi udara dan
                    node publik di tempat lain.
                  </p>
                </fieldset>

                <fieldset>
                  <legend>Peran</legend>
                  <label htmlFor="reg-role">Daftar sebagai</label>
                  <select id="reg-role" className="register-select" value={form.requested_role}
                    onChange={set("requested_role")}>
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <p className="register-hint">{role.hint}</p>
                  {form.requested_role && (
                    <>
                      <p className="register-verify">
                        Peran ini diverifikasi tim AEROSENSE terlebih dahulu. Sampai disetujui, akun Anda aktif
                        sebagai warga.
                      </p>
                      <label htmlFor="reg-note">Keterangan untuk verifikasi</label>
                      <textarea id="reg-note" className="register-note" maxLength={500} rows={3}
                        value={form.note} onChange={set("note")}
                        placeholder="Contoh: Staf lingkungan PT X, mengelola kawasan Y." />
                    </>
                  )}
                </fieldset>

                <button type="submit" className="login-submit" disabled={busy || DEMO_MODE}>
                  {busy ? "Membuat akun…" : "Daftar"}
                  <ArrowRight size={18} />
                </button>
              </form>
              <p className="login-register">
                Sudah punya akun? <Link to={ROUTES.LOGIN}>Masuk</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

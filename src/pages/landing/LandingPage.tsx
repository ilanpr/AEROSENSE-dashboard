import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Radio, CloudSun, MessageCircle, ChartNoAxesCombined, Menu, X, Check, Settings2, FileSpreadsheet } from "lucide-react";
import { AeroMascot } from "@/components/environment/AeroMascot";
import { ConditionScene } from "@/components/environment/ConditionScene";
import { useAuth } from "@/hooks/useAuth";
import { LandingTrend } from "./LandingTrend";
import "@/styles/landing.css";

const features = [
  { title: "Pantau titik di sekitar", icon: Radio, heading: "Pembacaan lokal, dalam satu tampilan.", description: "Lihat kondisi sensor di peta, waktu pembaruan, dan parameter yang tersedia. Pilih titik untuk mengenali perubahan di lokasi.", bullets: ["Pembacaan tiap perangkat", "Status dan waktu pembaruan", "Peta titik pemantauan"], path: "/dashboard", action: "Jelajahi pemantauan", scene: "sensor" as const },
  { title: "Pahami konteks wilayah", icon: CloudSun, heading: "Lihat gambaran lingkungan yang lebih luas.", description: "Lengkapi pembacaan sensor dengan informasi cuaca, kualitas udara wilayah, tanah, serta pantauan kejadian dari sumber publik.", bullets: ["Sumber dan waktu data terlihat", "Acuan lokasi yang dapat dipilih", "Data wilayah terpisah dari sensor"], path: "/environment", action: "Buka Hub Lingkungan", scene: "air" as const },
  { title: "Tanyakan pada AERO-BOT", icon: MessageCircle, heading: "Data lingkungan, lebih mudah dipahami.", description: "Tanyakan kondisi sekitar atau langkah sederhana untuk menjaga lingkungan. AERO-BOT membantu menjelaskan konteks sensor dan informasi wilayah yang tersedia.", bullets: ["Percakapan dengan konteks lokasi", "Pertanyaan melalui teks atau suara", "Sumber jawaban dan waktu data"], path: "/aerobot", action: "Temui AERO-BOT", scene: null },
  { title: "Telusuri dan unduh data", icon: ChartNoAxesCombined, heading: "Dari riwayat menjadi bahan evaluasi.", description: "Tinjau perubahan parameter dan susun bahan koordinasi. Pengguna yang berwenang dapat mengekspor data untuk dianalisis di spreadsheet.", bullets: ["Grafik riwayat parameter", "CSV untuk Excel atau Google Sheets", "Laporan lingkungan sesuai akses"], path: "/analytics", action: "Lihat riwayat udara", scene: "sensor" as const },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { user } = useAuth();
  const feature = features[active];
  return <div className="landing-page">
    <a className="landing-skip" href="#konten">Lewati navigasi</a>
    <header className="landing-header">
      <Link to="/" className="landing-brand" aria-label="AEROSENSE — Halaman utama"><img src="/assets/brand/aerosense-mark.png" alt="" width="40" height="40" /><span>AERO<strong>SENSE</strong></span></Link>
      <button className="landing-menu-button" aria-label={menuOpen ? "Tutup navigasi" : "Buka navigasi"} aria-expanded={menuOpen} aria-controls="landing-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
      <nav id="landing-navigation" className={menuOpen ? "is-open" : ""} aria-label="Navigasi halaman utama" onClick={() => setMenuOpen(false)}>
        <a href="#fitur">Fitur</a><a href="#cara-kerja">Cara kerja</a><a href="#pengelola">Untuk pengelola</a>
        <Link to={user ? "/dashboard" : "/login"} className="landing-nav-login">{user ? "Buka dashboard" : "Masuk"}<ArrowUpRight size={16} /></Link>
      </nav>
    </header>
    <main id="konten">
      <section className="landing-hero landing-container">
        <div className="landing-hero-copy">
          <h1>Udara lebih dipahami.<br /><span>Tindakan lebih terarah.</span></h1>
          <p>Kenali kondisi di sekitar Anda melalui sensor, informasi lingkungan wilayah, dan AERO-BOT. Satu tempat untuk memantau, memahami, dan menindaklanjuti.</p>
          <div className="landing-actions"><Link className="landing-button" to="/dashboard">Lihat pemantauan<ArrowRight size={19} /></Link><Link className="landing-text-link" to="/login">Masuk ke akun<ArrowUpRight size={17} /></Link></div>
          <div className="landing-hero-points"><span><Check size={15} /> Pemantauan publik</span><span><Check size={15} /> Konteks berbasis lokasi</span></div>
        </div>
        <div className="landing-hero-art" aria-label="Maskot AERO-BOT dan perangkat sensor AEROSENSE">
          <span className="landing-art-glow" aria-hidden="true" />
          <span className="landing-art-dot art-dot-one" aria-hidden="true" /><span className="landing-art-dot art-dot-two" aria-hidden="true" /><span className="landing-art-dot art-dot-three" aria-hidden="true" />
          <AeroMascot pose="welcome" className="landing-hero-mascot" />
          <img className="landing-hero-sensor" src="/assets/environment/sensor-node-v3.webp" width="240" height="240" alt="Ilustrasi perangkat sensor AEROSENSE" />
        </div>
      </section>

      <section id="fitur" className="landing-features landing-container">
        <div className="landing-section-heading"><h2>Satu kawasan.<br /><span>Gambaran yang lebih utuh.</span></h2><p>Dari pembacaan di titik pemasangan sampai konteks wilayah, temukan informasi yang Anda perlukan.</p></div>
        <div className="landing-feature-layout">
          <div className="landing-feature-options" aria-label="Pilih fitur AEROSENSE">{features.map((item, index) => <button key={item.title} aria-pressed={active === index} onClick={() => setActive(index)}><item.icon size={22} /><span>{item.title}</span><ArrowUpRight size={17} /></button>)}</div>
          <article className="landing-feature-detail" aria-live="polite">
            <div><h3>{feature.heading}</h3><p>{feature.description}</p><ul>{feature.bullets.map(bullet => <li key={bullet}><Check size={15} />{bullet}</li>)}</ul><Link className="landing-text-link" to={feature.path}>{feature.action}<ArrowRight size={17} /></Link></div>
            <div className="landing-feature-illustration">{feature.path === "/analytics" ? <LandingTrend /> : feature.scene ? <ConditionScene scene={feature.scene} /> : <AeroMascot pose="watch" />}</div>
          </article>
        </div>
      </section>

      <section id="cara-kerja" className="landing-workflow landing-container">
        <h2>Dari lingkungan,<br /><span>menjadi dasar tindakan.</span></h2>
        <div className="landing-workflow-steps">
          <article><Radio size={25} /><h3>Ukur di lokasi</h3><p>Sensor merekam parameter pada titik pemasangan dan mengirimkan pembacaan ke sistem.</p></article>
          <article><CloudSun size={25} /><h3>Pahami konteksnya</h3><p>Dashboard menghubungkan pembacaan, riwayat, dan informasi wilayah. AERO-BOT membantu menjelaskannya.</p></article>
          <article><Settings2 size={25} /><h3>Tindak lanjuti bersama</h3><p>Pengelola meninjau peringatan, menetapkan ambang operasional, dan menyiapkan data untuk koordinasi.</p></article>
        </div>
      </section>

      <section id="pengelola" className="landing-management landing-container">
        <div><h2>Kawasan Anda.<br /><span>Pengelolaan lebih terarah.</span></h2><p>Untuk tim industri dan kader governance: kelola ambang waspada dan bahaya pada lokasi yang ditugaskan, lalu unduh data untuk evaluasi bersama.</p><div className="landing-actions"><Link className="landing-button landing-button-white" to={user ? "/management" : "/login"}>Kelola kawasan<ArrowRight size={18} /></Link><Link className="landing-management-link" to="/analytics"><FileSpreadsheet size={18} />Telusuri riwayat</Link></div></div>
        <div className="landing-management-details"><p><Settings2 size={21} /><span><strong>Ambang sesuai kebutuhan lokasi</strong>Waspada, bahaya, batas pulih, dan jeda notifikasi.</span></p><p><FileSpreadsheet size={21} /><span><strong>Data siap diolah</strong>Ekspor CSV untuk Excel dan Google Sheets.</span></p><p><Check size={21} /><span><strong>Akses sesuai penugasan</strong>Admin menetapkan pengelola untuk setiap lokasi.</span></p></div>
      </section>
      <aside id="tentang-data" className="landing-data-note landing-container"><strong>Memahami data dengan tepat.</strong><p>Pembacaan sensor dan estimasi wilayah ditampilkan terpisah, lengkap dengan waktu dan ketersediaannya. Ambang pengelola digunakan untuk pemantauan operasional; penilaian kepatuhan memerlukan pemeriksaan tersendiri.</p></aside>
    </main>
    <footer className="landing-footer landing-container"><Link to="/" className="landing-brand"><img src="/assets/brand/aerosense-mark.png" alt="" width="30" height="30" /><span>AERO<strong>SENSE</strong></span></Link><p>Pantau lingkungan sekitar.</p><Link to="/dashboard">Buka pemantauan<ArrowUpRight size={15} /></Link></footer>
  </div>;
}

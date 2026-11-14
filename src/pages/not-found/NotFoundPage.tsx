import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { AeroMascot } from "@/components/environment/AeroMascot";
import { ROUTES } from "@/lib/constants";

export function NotFoundPage() {
  return (
    <main className="confirm-page">
      <section className="confirm-card missing-page">
        <AeroMascot pose="watch" />
        <h1>Halaman tidak ditemukan</h1>
        <p>Periksa alamatnya atau kembali ke pemantauan.</p>
        <Link to={ROUTES.DASHBOARD} className="login-submit">
          Lihat pemantauan <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}

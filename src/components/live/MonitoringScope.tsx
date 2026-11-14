import { ExternalLink, ChevronDown } from "lucide-react";

export function MonitoringScope() {
  return (
    <section className="monitoring-scope" aria-label="Cakupan pemantauan">
      <details>
        <summary>
          <span>Metode & cakupan laporan</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="scope-content">
          <p>
            Laporan memuat pembacaan dan peringatan di lokasi terpilih. Statistik memakai
            pembacaan yang lolos pemeriksaan kualitas.
          </p>
          <p>
            Debu optik dan PM2.5 tervalidasi ditampilkan terpisah. Hasil model adalah estimasi.
          </p>
          <p className="scope-limit">
            Pemantauan ambien mendukung evaluasi lingkungan, bukan penetapan sumber pencemar,
            kepatuhan, atau inventaris emisi perusahaan. Verifikasi independen tidak termasuk dalam
            laporan.
          </p>
          <a
            className="scope-reference"
            href="https://www.epa.gov/air-sensor-toolbox/air-sensor-use-and-study-design"
            target="_blank"
            rel="noreferrer"
          >
            Acuan penggunaan sensor · EPA <ExternalLink size={13} />
          </a>
        </div>
      </details>
    </section>
  );
}

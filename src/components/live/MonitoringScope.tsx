import { ExternalLink, ChevronDown } from "lucide-react";

export function MonitoringScope({ report = false }: { report?: boolean }) {
  return <section className="monitoring-scope" aria-label="Cakupan pemantauan">
    <details>
      <summary><span>{report ? "Metode & cakupan laporan" : "Tentang data pemantauan"}</span><ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="scope-content">
        <p>{report
          ? "Laporan merangkum pembacaan sensor, waktu pengamatan, dan peringatan pada lokasi terpilih. Statistik menggunakan data yang lolos pemeriksaan kualitas."
          : "Sensor AEROSENSE menunjukkan kondisi di titik pemasangan. Informasi cuaca, kualitas udara wilayah, dan kejadian publik melengkapi pembacaan lokal."}</p>
        <p>Debu optik dan PM2.5 tervalidasi dilaporkan terpisah. eCO₂ merupakan estimasi sensor gas; hasil model ditandai sebagai estimasi.</p>
        <p className="scope-limit">Pemantauan ambien mendukung evaluasi lingkungan, bukan penetapan sumber pencemar, kepatuhan, atau inventaris emisi perusahaan. Verifikasi independen tidak termasuk dalam laporan.</p>
        <a className="scope-reference" href="https://www.epa.gov/air-sensor-toolbox/air-sensor-use-and-study-design" target="_blank" rel="noreferrer">Acuan penggunaan sensor · EPA <ExternalLink size={13} /></a>
      </div>
    </details>
  </section>;
}

import { ExternalLink } from "lucide-react";

export function MonitoringScope({ report = false }: { report?: boolean }) {
  return (
    <section className="monitoring-scope" aria-label="Cakupan pemantauan">
      <details open={report}>
        <summary>
          <span>{report ? "Penggunaan bukti untuk ESG" : "Tentang pemantauan & biaya"}</span>
          <span className="scope-summary-note">{report ? "Cakupan laporan" : "Lihat penjelasan"}</span>
        </summary>
        <div className="scope-content">
          <h2>Pemantauan bersama di sekitar kawasan industri</h2>
          <p>
            Node menunjukkan kondisi udara di titik pemasangan. Angin, aktivitas
            sekitar, dan asap dari wilayah lain membantu pemeriksaan sumber pencemar.
          </p>
          {report ? (
            <dl className="scope-evidence">
              <div><dt>Lingkungan</dt><dd>Riwayat pembacaan, lokasi, waktu, dan hasil model membantu pemeriksaan kondisi udara.</dd></div>
              <div><dt>Masyarakat</dt><dd>Rancangan berikutnya: laporan warga, tanggapan, dan umpan balik pelapor.</dd></div>
              <div><dt>Tata kelola</dt><dd>Rancangan berikutnya: penanggung jawab, nomor laporan, dan bukti penyelesaian.</dd></div>
            </dl>
          ) : (
            <dl className="scope-evidence">
              <div><dt>Gateway bersama</dt><dd>Rancangan LoRa memusatkan koneksi internet pada gateway. Jangkauan dan biaya operasi perlu diuji di lokasi.</dd></div>
              <div><dt>Asal data terlihat</dt><dd>Pembacaan node, hasil model, dan informasi wilayah memiliki peran berbeda. Estimasi tidak membuktikan kondisi di titik sensor.</dd></div>
              <div><dt>Biaya yang dihitung</dt><dd>Acuan tracker tim: <strong>Rp633.500</strong> untuk lima komponen dasar satu node. HPP dan harga jual belum final.</dd></div>
            </dl>
          )}
          <p className="scope-limit">
            {report
              ? "Laporan pemantauan belum mendapat assurance independen. Data ini tidak menetapkan sumber pencemar, kepatuhan, skor ESG, atau jumlah emisi perusahaan."
              : "Sensor berbiaya rendah perlu pengujian pembanding. Kelayakan dinilai dari mutu data, biaya tiap titik yang layak, dan manfaat bagi pengguna."}
          </p>
          <details className="scope-method">
            <summary>Metode, biaya lengkap & sumber</summary>
            <p>
              Lima komponen dasar: ESP32 Rp189.000, LoRa Rp160.000, sensor debu
              Rp70.000, SGP30 Rp152.000, dan AM2302 Rp62.500. Acuan tracker tim
              18 Oktober 2026. Gateway, daya, casing, perakitan, pengujian,
              pemasangan, server, lisensi API, dan perawatan perlu dihitung terpisah.
            </p>
            <p>
              eCO₂ sensor berbeda dari CO₂e inventaris gas rumah kaca. Sinyal debu
              optik memerlukan validasi sebelum digunakan sebagai PM2.5.
              Data wilayah adalah konteks tambahan. Penurunan angka belum
              membuktikan keberhasilan tindakan atau pengurangan emisi.
            </p>
            <p>
              Laporan mengekspor maksimal 288 pembacaan terakhir per node.
              Cakupan waktu mengikuti data yang tersedia. Pelaporan ke instansi
              dan pemantauan penyelesaian masih dalam pengembangan.
            </p>
            <ul className="scope-sources">
              <li><a href="https://www.epa.gov/air-sensor-toolbox/air-sensor-use-and-study-design" target="_blank" rel="noreferrer">Penggunaan sensor tambahan · EPA <ExternalLink size={13} /></a></li>
              <li><a href="https://www.globalreporting.org/publications/documents/english/gri-305-emissions-2016/" target="_blank" rel="noreferrer">Emisi udara · GRI 305-7 <ExternalLink size={13} /></a></li>
              <li><a href="https://www.globalreporting.org/publications/documents/english/gri-413-local-communities-2016/" target="_blank" rel="noreferrer">Masyarakat lokal · GRI 413 <ExternalLink size={13} /></a></li>
              <li><a href="https://www.globalreporting.org/publications/documents/english/gri-2-general-disclosures-2021/" target="_blank" rel="noreferrer">Assurance & penanganan keluhan · GRI 2 <ExternalLink size={13} /></a></li>
            </ul>
          </details>
        </div>
      </details>
    </section>
  );
}

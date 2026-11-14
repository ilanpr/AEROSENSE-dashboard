# Posisi AEROSENSE dan bukti untuk juri

AEROSENSE dikembangkan sebagai jaringan pemantauan bersama di sekitar kawasan industri. Nilai yang diuji adalah biaya tiap titik pemantauan yang layak, keterlacakan data, kemudahan memahami kondisi, dan koordinasi tindak lanjut. Perangkat di buffer zone mengamati udara ambien. Lokasinya tidak otomatis membuktikan emisi atau sumber pencemar tertentu.

## Acuan biaya

Snapshot tracker tim 18 Oktober 2026, lima komponen dasar per node:

| Komponen | Biaya |
| --- | ---: |
| ESP32-S3 | Rp189.000 |
| LoRa | Rp160.000 |
| Sharp | Rp70.000 |
| SGP30 | Rp152.000 |
| AM2302 | Rp62.500 |
| Subtotal dasar | Rp633.500 |

Ini belum HPP atau harga jual. Lengkapi daya, antena, PCB, casing, rakit, pengujian, kalibrasi/koreksi yang diperlukan, instalasi, gateway, server, lisensi API, pemeliharaan, penggantian, dan garansi. Pi aset/pinjaman tetap mempunyai biaya pengadaan atau depresiasi. Robot dan mini PC menjadi opsi terpisah.

TCO periode yang sama = pengadaan lengkap + pemasangan + layanan + perawatan + penggantian. Biaya per titik layak = TCO / jumlah titik yang memenuhi kriteria mutu selama periode evaluasi. Nyatakan durasi, jumlah titik, dan kriteria kelayakan. Node murah yang datanya gagal memenuhi kebutuhan tidak dihitung sebagai titik layak. Jangan menghitung persentase penghematan sebelum biaya lengkap tersedia.

Tracker: https://docs.google.com/spreadsheets/d/1sle8oyH9BslmTKLYYHwalDF_2TQLRTQh4-iWq5OQ6oo/edit

## Kandidat pembeda dan cara membuktikannya

Semua baris berikut adalah fokus penerapan, bukan klaim fitur eksklusif atau kemenangan atas pesaing. Status lapangan memerlukan bukti baru; source code dan replay tidak membuktikan deployment.

| Pembeda | Manfaat dan hubungan biaya | Bukti/status yang harus dijelaskan |
| --- | --- | --- |
| Gateway LoRa bersama | Memusatkan internet dan komputasi; potensi membagi biaya pada beberapa titik | Arsitektur tersedia; ukur packet delivery, latensi, kebutuhan daya, biaya koneksi, dan jangkauan aktual. Jangan menjanjikan radius tertentu. |
| Penempatan menurut peran titik | Membandingkan titik pembanding, batas kawasan, dan permukiman sesuai anggaran | Rancangan pilot; jumlah/posisi mengikuti survei, angin, dan akses lokasi. Tidak setiap pemasangan harus mempunyai tiga node, tetapi studi perbandingan memerlukan titik yang memadai. |
| Mutu dan asal angka terlihat | Mengurangi risiko keputusan dari data rusak tanpa menyamakan estimasi dengan pengukuran | Web memisahkan raw/GRU; validasi replay berbeda dari uji fisik. Uji alarm keliru, kehilangan kejadian lokal, bias dan selisih tiap kanal. |
| Data publik sebagai konteks | Menambah konteks tanpa memasang seluruh sensor regional sendiri | Kode hub per koordinat tersedia; periksa deployment, sumber, timestamp, masa berlaku dan biaya/lisensi API. Tidak mengganti sensor hilang dengan API publik. |
| Informasi untuk pengguna awam | Membantu warga membaca kondisi dan mengurangi kebutuhan menafsirkan log sendiri | Ringkasan dan sumber tersedia di UI; ukur keberhasilan tugas dan pemahaman melalui uji pengguna, bukan klaim tampilan semata. |
| Akses komunal menurut peran | Pengelola dan warga memakai lokasi yang sama dengan kewenangan berbeda | Login/keanggotaan tersedia; uji pemisahan lokasi. Banyak akun tidak otomatis membuktikan keterlibatan masyarakat. |
| Penanganan kejadian tercatat | Menghubungkan temuan dengan pemeriksa dan bukti penyelesaian | Masih pengembangan. Acknowledge peringatan yang ada bukan bukti laporan terkirim atau selesai. Ukur waktu respons dan penyelesaian berbukti setelah diimplementasikan. |
| Bukti pendukung ESG | Mengurangi pengumpulan ulang riwayat sensor dan dokumen penanganan | Ekspor pemantauan tersedia; S/G memerlukan laporan warga, keputusan dan tanggapan nyata. Belum assurance, penilaian ESG menyeluruh atau audit kepatuhan. |
| Paket sesuai kebutuhan | Memisahkan node, gateway bersama, dan robot opsional sehingga lingkup belanja jelas | Subtotal dasar diketahui; HPP dan TCO belum lengkap. Varian sensor khusus industri perlu dipilih berdasar polutan sasaran dan diuji. |

## Jawaban atas kekhawatiran sensor murah

“Kami menguji apakah mutu data memenuhi tujuan pemantauan awal pada biaya yang terjangkau. Penilaian mencakup selisih terhadap pembanding, alarm keliru, ketersediaan, dan kejadian yang terlewat. Jika kanal belum memenuhi kriteria, cakupan penggunaannya dibatasi atau sensornya ditingkatkan.”

Hasil lebih banyak titik hanya bermanfaat bila tiap titik layak untuk tujuan yang ditetapkan. Model tidak menggantikan kalibrasi atau membuat kanal nonselektif menjadi selektif. Raw tetap dipertahankan; fallback tetangga dilabeli dan tidak menjadi bukti bahwa lokasi bermasalah mempunyai kondisi yang sama dengan donor. Lonjakan lokal perlu diperiksa, bukan otomatis dihapus.

## Industri dan asap regional

Pola antar-node, angin lokal, waktu kegiatan, pengamatan lapangan dan informasi kebakaran membantu pemeriksaan. Pola itu belum membuktikan sumber. Angin API adalah konteks model regional; pengamatan lokal diperlukan untuk studi dekat sumber. Hotspot satelit bukan konfirmasi karhutla, dan ketiadaan hotspot bukan bukti tidak ada kebakaran.

Rujukan: https://www.epa.gov/sciencematters/tracking-emissions-using-new-fenceline-monitoring-technology

## Batas dan kontribusi ESG

| Pilar | Bukti yang bisa didukung | Tambahan yang diperlukan |
| --- | --- | --- |
| E | Riwayat udara ambien, kualitas pembacaan, lokasi/waktu | Validasi per kanal dan studi sebelum/sesudah dengan kondisi pembanding |
| S | Rancangan akses dan informasi warga | Partisipasi, laporan, tanggapan dan umpan balik nyata |
| G | Rancangan pemeriksaan dan riwayat keputusan | Penanggung jawab, jejak perubahan, nomor laporan dan bukti penyelesaian |

GRI 305-7 meminta jumlah emisi udara signifikan beserta metode; konsentrasi buffer zone tidak langsung memenuhi inventaris emisi. eCO2 sensor berbeda dari CO2e inventaris GRK. Rujukan GRI di UI adalah pemetaan kebutuhan bukti, bukan pernyataan kesesuaian penuh. Tidak ada skor kepatuhan, stempel resmi, carbon credit, atau assurance otomatis.

- Emisi: https://www.globalreporting.org/publications/documents/english/gri-305-emissions-2016/
- Masyarakat: https://www.globalreporting.org/publications/documents/english/gri-413-local-communities-2016/
- Assurance dan keluhan: https://www.globalreporting.org/publications/documents/english/gri-2-general-disclosures-2021/
- Inventaris GRK: https://ghgprotocol.org/calculation-tools-faq

Pertahankan bukti kejadian sesuai kebijakan retensi, arsip dan koreksi. Pembersihan cache API tidak boleh sekaligus menghapus bukti laporan.

## Perbandingan yang adil

IQAir memiliki jaringan, peringatan, akses data dan dashboard. AirGradient mendukung perangkat serta integrasi terbuka. Jangan menandai fitur pesaing sebagai tidak ada tanpa pemeriksaan. Bandingkan paket yang sama: jumlah lokasi, parameter, validasi, komunikasi, instalasi, layanan, dan TCO pada periode yang sama. Hindari membandingkan subtotal komponen AEROSENSE dengan harga retail perangkat lengkap.

- https://www.iqair.com/ae/air-quality-monitors/enterprise-dashboard
- https://www.airgradient.com/outdoor/

## Posisi untuk presentasi

“AEROSENSE menguji pendekatan pemantauan bersama di sekitar industri dengan gateway LoRa bersama. Biaya dihitung per titik yang datanya layak. Pembacaan dan sumber pendukung membantu pemeriksaan, sedangkan alur tindak lanjut serta bukti ESG kami kembangkan bersama calon pengguna. Klaim penerapan mengikuti hasil uji yang dapat dibuka.”

Video tetap 10:00. PPT pendamping tidak memakai timestamp. Naskah dan brief utama tetap di Visual Aerosense pada tab revisi.

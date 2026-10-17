# Ringkasan lingkungan dan akses audit

Branch: `feat/environment-insights`, melanjutkan integrasi backend sebelumnya.

## Yang dilihat pengguna

Beranda mengutamakan pembacaan node AEROSENSE, diikuti informasi lingkungan publik. Setiap panel menampilkan kesimpulan singkat, angka penting dan langkah yang bisa dilakukan. Panel **Sumber & cara membaca data** memuat atribusi, tautan penyedia, waktu pembaruan, lokasi acuan, dan batas interpretasi.

Data yang kedaluwarsa tidak menjadi dasar ringkasan kondisi saat ini. Prakiraan diberi label prakiraan; catatan gempa tetap menjadi referensi. Jika node belum mengirim pembaruan, panel utama menampilkan status menunggu dengan angka kosong. Informasi publik tidak menjadi pengganti nilai sensor.

Ilustrasi 3D tersedia per kondisi. Animasi memakai CSS dan video latar ringan yang dirender dengan Remotion. Web tidak memuat Remotion Player. Gerak bisa dijeda, berhenti saat panel tidak terlihat, dan mengikuti pengaturan Reduce Motion. Detail aset ada di [ENVIRONMENT_VISUALS.md](ENVIRONMENT_VISUALS.md).

## Alur n8n ke web

1. Node HTTP mengambil data penyedia sesuai jadwal cache yang sudah ada.
2. **Rapikan fakta dan sumber** tetap memeriksa koordinat, format, waktu, dan nilai. Node yang sama menambahkan `payload.insights` dan `payload.summary_method`, serta mempertahankan kode cuaca WMO agar ilustrasi sesuai data.
3. **Simpan cache lingkungan Supabase** menyimpan payload ke `ae_environment_area_cache`. Tidak diperlukan tabel atau migrasi baru.
4. `GET /v1/environment` memeriksa kembali koordinat dan masa berlaku saat cache dibaca. API menyusun ringkasan lintas penyedia, mengurutkan rincian terbaru lebih dulu, dan memberikan hasil kepada web.

Pemeriksaan saat membaca diperlukan karena ringkasan yang benar ketika disimpan bisa kedaluwarsa sebelum pembaruan berikutnya. Ringkasan n8n disimpan per penyedia; API menggabungkan bukti yang masih berlaku pada area yang sama.

Kode bersama ada di `server/api/environment-insights.mjs`. Salinan untuk editor Code n8n ada di `n8n/environment-normalizer.js`. Untuk memperbaruinya dari backup kode asli node:

```bash
node server/scripts/build-environment-node.mjs original-node.js n8n/environment-normalizer.js
```

Masukkan hasilnya ke node **Rapikan fakta dan sumber** pada workflow **AEROSENSE | Hub lingkungan**. Ini adalah kode satu node, bukan file JSON impor workflow. Pengujian menjalankan salinan kode tersebut agar bentuk output dan filter tetap diperiksa.

## Biaya dan batas kesimpulan

Ringkasan memakai aturan lokal, tanpa panggilan Gemini atau API tambahan. Cache dan jadwal penyedia tetap digunakan. Gemini tetap tersedia saat pengguna bertanya melalui AERO-BOT.

- Kategori udara menggunakan **US AQI dari penyedia**, bukan konversi PM2.5 sesaat dan bukan ISPU. Acuan kategori: [AirNow](https://www.airnow.gov/aqi/aqi-basics/) dan [Open-Meteo](https://open-meteo.com/en/docs/air-quality-api).
- Sebutan sejuk, hangat, dan panas adalah deskripsi antarmuka, bukan ambang bahaya atau peringatan kesehatan resmi.
- Kadar air tanah tidak cukup untuk menetapkan kekeringan, kesuburan, atau kebutuhan siram tanpa sifat tanah dan tanaman.
- Titik panas bukan kebakaran terkonfirmasi. Debit sungai bukan status banjir. Cakupan feed dan waktu kejadian tetap tersedia pada rincian.
- Data publik tidak mengubah koordinat, histori, atau hasil model sensor AEROSENSE.

## Audit ESG khusus admin

Hak akses diambil dari `ae_members`, bukan metadata profil yang bisa diubah pengguna.

| Jalur                        | Pemeriksaan                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Menu Audit ESG               | Ditampilkan setelah `/v1/access` mengonfirmasi keanggotaan admin             |
| `/esg-reports`               | Pengunjung diarahkan ke login; akun non-admin mendapat penolakan             |
| `/v1/esg/report`             | Backend memeriksa sesi dan peran admin pada setiap permintaan                |
| `/v1/esg/report?node_id=...` | Hanya node dari lokasi yang dikelola sebagai admin; lokasi lain mendapat 403 |

Viewer, operator, dan auditor tidak mendapat akses audit ESG. Admin pada satu lokasi tidak otomatis menjadi admin lokasi lain. Pembacaan sensor biasa tetap mengikuti keanggotaan yang sudah ada. Laporan adalah data pemantauan, bukan sertifikasi kepatuhan atau perhitungan emisi.

## Mencoba branch di server

```bash
cd ~/aerosense-preview
git fetch origin
git switch feat/environment-insights
docker compose up -d --build
```

Backend perlu diperbarui juga. Cadangkan folder backend dan pertahankan `.env` yang sudah berisi credential:

```bash
cp -a ~/aerosense-api "$HOME/aerosense-api-backup-$(date +%Y%m%d-%H%M%S)"
cp -a ~/aerosense-preview/server/. ~/aerosense-api/
cd ~/aerosense-api
docker compose up -d --build aerosense-api
```

Tambahkan origin preview pada `WEB_ORIGINS` bila belum ada. Lihat [DEPLOYMENT.md](DEPLOYMENT.md) untuk konfigurasi domain, proxy, dan pengujian koneksi. Build serta tes lokal tidak membuktikan bahwa server Ubuntu sudah memakai perubahan ini.

## Verifikasi pengembangan, 17 Oktober 2026

- 16 tes Node lulus, termasuk angka penting yang masih berlaku, pemilihan gambar cuaca, hysteresis peringatan sensor, kategori AQI, penolakan data lama, eksekusi kode n8n, penolakan audit bagi viewer/operator/auditor, dan penolakan admin pada lokasi lain.
- Pemeriksaan browser memakai data sintetis lokal. Menu audit tersembunyi untuk viewer dan URL audit menampilkan penolakan. Seluruh kategori hub dapat dipilih; rincian dan atribusi tersedia melalui panel yang dapat dibuka.
- Node pada `flow.aerosense.me` diperbarui dan alur lengkap diuji manual. Cache Supabase nyata terkonfirmasi menyimpan `rules-v1` pada Open-Meteo cuaca, Open-Meteo udara, FIRMS, dan BMKG gempa. Tidak semua penyedia menghasilkan ringkasan baru pada uji ini.
- Workflow Hub masih berstatus tidak aktif saat diperiksa. Uji manual tidak mengaktifkan jadwal otomatis.
- Perubahan frontend dan backend pada branch ini belum dideploy ke Ubuntu. Hak admin nyata tetap berasal dari `ae_members` yang sudah ada.

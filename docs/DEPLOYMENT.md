# Deploy ke server AEROSENSE

Repositori berisi frontend dan backend. n8n tetap berjalan pada container yang sudah ada. Contoh berikut memakai network Docker n8n_default dan hostname aerosense-api.

## 1. Persiapan

- Node.js 22 untuk build lokal, atau Docker untuk build di server.
- URL dan publishable/anon key Supabase.
- Service-role key Supabase hanya untuk backend.
- INTERNAL_API_KEY yang sama dengan credential internal n8n.
- WEB_ORIGINS mencakup https://aerosense.me dan origin lokal jika pengujian dibutuhkan.
- Credential Postgres, Gemini dan WhatsApp pada n8n.
- Akses mengubah Cloudflare Tunnel atau reverse proxy domain.

Jangan menimpa file .env server yang sudah berisi credential. Salin contoh hanya jika file belum ada.

## 2. Database

Instalasi baru: jalankan SQL di server/supabase sesuai urutan 001 sampai 005 melalui SQL Editor Supabase. 001 dan 002 berasal dari paket otomasi sebelumnya.

Instalasi yang sudah memiliki tabel ae_: periksa struktur terlebih dahulu. Jangan menjalankan ulang 001 karena tabel dan fungsi dasar sudah ada. 003 menyiapkan cache publik serta acuan Surabaya; tidak mengubah koordinat ae_nodes. 004 memasang event job. Fungsi ae_ready_kinds sudah disertakan pada 002. Migrasi 005 menyiapkan cache berita bencana nasional.

Berikan akses lokasi secara sengaja melalui ae_members. Ambil user_id dari Supabase Auth dan location_id dari ae_nodes yang sebenarnya. Pendaftaran akun tidak memberikan peran admin.

## 3. Perbarui backend yang sudah ada

Backend sebelumnya berada di ~/aerosense-api. Cadangkan source dan .env sebelum mengganti source. Untuk menghindari dua service dengan alias aerosense-api pada network yang sama, gunakan satu backend saja.

Salin isi direktori server dari checkout ini ke direktori backend tersebut, dengan mempertahankan .env lama. Tambahkan:

```env
ENVIRONMENT_AREA_ID=surabaya
DISASTER_NEWS_ENABLED=true
WEB_ORIGINS=https://aerosense.me
```

Kemudian di ~/aerosense-api:

```bash
docker compose up -d --build aerosense-api
curl --fail http://127.0.0.1:8080/health
curl --fail http://127.0.0.1:8080/v1/disasters
docker compose exec -T aerosense-api node scripts/check-db.mjs
```

Di n8n, api_base_url tetap http://aerosense-api:8080. Internal key tetap dimasukkan lewat credential n8n.

## 4. Jalankan web baru

Dari root checkout:

```bash
docker compose up -d --build
curl --fail http://127.0.0.1:8082/api/v1/config
curl --fail http://127.0.0.1:8082/api/v1/environment
```

Config harus hanya menampilkan URL Supabase, publishable key, area dan robot default. Endpoint environment memerlukan cache yang sudah diisi oleh Hub lingkungan. Jika belum ada, jalankan hub secara manual dahulu.

Container web baru menggunakan port host 127.0.0.1:8082. Dashboard lama di port 80 tidak perlu dihentikan untuk pengujian ini.

Jika Cloudflare Tunnel berjalan sebagai service host, setelah pengujian berhasil arahkan hostname aerosense.me ke http://localhost:8082. Jika tunnel berjalan di container lain, gunakan koneksi network yang sesuai. Simpan tujuan lama agar dapat dikembalikan jika pengujian setelah perpindahan gagal.

## 5. Aktifkan alur n8n

- Control Center mendengarkan channel aerosense_events dengan koneksi Postgres direct/session pooler yang mendukung LISTEN.
- Worker Jawaban website menerima kind web_chat.
- Worker robot menerima robot_chat.
- Worker Data udara menerima telemetry.
- Hub lingkungan menggunakan environment_area_id surabaya dan dijalankan terjadwal.
- Maintenance dan pemulihan job tetap aktif.
- Execute Sub-workflow mengarah ke workflow ID pada instance saat ini, bukan ID instance lama.

Pengujian manual worker tidak membuktikan trigger produksi aktif. Pastikan Control Center sudah dipublikasikan/diaktifkan. Sub-workflow dipanggil melalui Execute Sub-workflow, sedangkan trigger jadwal/event perlu aktif sesuai versi n8n.

## 6. Uji dari web

1. Buka /environment tanpa login. Periksa sumber dan waktu data.
2. Login dengan akun Supabase yang sudah dikonfirmasi.
3. Buka /nodes. Node yang tampil harus sesuai ae_members, dengan koordinat asli.
4. Jika sensor belum mengirim, nilai tetap kosong. Jangan menambahkan nilai contoh ke tabel produksi.
5. Buka /aerobot dan kirim pertanyaan umum lingkungan tanpa memilih node.
6. Periksa satu job web_chat pada ae_jobs. Status bergerak dari pending ke running lalu done. Jawaban ada di result.text.
7. Pastikan jawaban yang sama muncul di web.
8. Gunakan akun berbeda untuk memastikan job akun pertama tidak dapat dibaca.
9. Periksa aturan dan kode WhatsApp dengan akun yang memiliki akses yang sesuai.
10. Untuk robot, uji agent perangkat secara terpisah sebelum menganggap speaker atau mikrofon sudah berfungsi.

## Batas layanan

REST SoilGrids belum tersedia. IQAir memerlukan key dan BMKG cuaca memerlukan kode ADM4. Halaman tidak mengisi data yang hilang dengan angka buatan.

Docker Desktop lokal tidak aktif pada saat pengembangan ini. Build dan pengujian Node dapat dijalankan, sedangkan build image serta proxy nginx perlu diverifikasi pada server Docker yang aktif.

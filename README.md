# AEROSENSE Dashboard

AEROSENSE menggabungkan pemantauan sensor, hasil model GRU, dan informasi lingkungan publik. AERO-BOT menjelaskan data yang tersedia melalui chat web dan layar robot. Pemrosesan pertanyaan serta notifikasi dijalankan di n8n.

## Fitur

- Hub lingkungan Surabaya: cuaca, udara, tanah, titik panas, sungai, dan gempa.
- Kabar bencana Indonesia dari ANTARA dan GDACS, dengan sumber dan tautan bantuan resmi.
- Ringkasan kondisi dan saran singkat tanpa panggilan AI tambahan. Angka serta sumber tersedia pada panel rincian.
- Peta mengikuti koordinat asli setiap node.
- Pembacaan terbaru, historis input, hasil GRU, dan ekspor JSON.
- Chat melalui backend, dengan jawaban dibaca dari job milik pengguna.
- Login Supabase, akses lokasi berdasarkan keanggotaan, dan aturan peringatan untuk operator.
- Audit ESG khusus admin, diperiksa pada halaman dan endpoint backend sesuai lokasi.
- Penghubung langganan WhatsApp dan perintah mendengarkan pada layar robot.

Jika sensor belum mengirim data, dashboard menampilkan kondisi kosong. Informasi publik tidak dimasukkan sebagai pembacaan sensor.

## Alur sistem

```text
ESP32 / LoRa → gateway → API → Supabase
                                   ↓
                      event job → n8n → Gemini
                                   ↓
Web / layar robot ← API ← hasil di Supabase

API publik → n8n Hub lingkungan → cache Supabase → API → web dan konteks AERO-BOT
```

Web memakai tabel `ae_` yang sama dengan workflow yang sudah ada. Dokumen skema lama di root menyimpan rancangan awal. Skema integrasi saat ini ada di [server/supabase](server/supabase) dan dijelaskan dalam [panduan integrasi](docs/INTEGRATION.md).

## Menjalankan lokal

Gunakan Node.js 22 dan pnpm.

```bash
pnpm install --frozen-lockfile
cd server && npm ci && cd ..
cp server/.env.example server/.env
```

Isi credential backend dalam `server/.env`. Kemudian, dari dua terminal:

```bash
cd server
node --env-file=.env api/server.mjs
```

```bash
pnpm dev --host 127.0.0.1
```

Vite meneruskan `/api` ke `http://127.0.0.1:8080`. Browser mengambil URL Supabase dan publishable key melalui konfigurasi publik backend. Service-role key, credential perangkat, dan internal key tetap di server. Gemini serta WhatsApp memakai credential n8n.

## Pemeriksaan

```bash
pnpm test
pnpm lint
pnpm build
```

Untuk pemeriksaan browser tanpa layanan produksi, jalankan `node server/tests/preview.mjs`, lalu jalankan Vite dengan variabel shell `API_PROXY_TARGET=http://127.0.0.1:8081`. Login pengujian: `preview@example.test` dengan password `fixture-password`. Sensor, cuaca dan jawaban pada mode ini sintetis dan hanya berada di proses lokal. Untuk mencoba berita asli saja, set PREVIEW_LIVE_NEWS=true sebelum menjalankan fixture. Jangan mengarahkan domain produksi ke server fixture.

## Deploy

Panduan lengkap: [DEPLOYMENT.md](docs/DEPLOYMENT.md).

Penjelasan ringkasan n8n, urutan data, dan pembatasan audit: [ENVIRONMENT_INSIGHTS.md](docs/ENVIRONMENT_INSIGHTS.md).

Berita bencana dan sumber publik: [DISASTER_NEWS.md](docs/DISASTER_NEWS.md).

Hasil pemeriksaan alur otomatis dan langkah penerapan: [BACKEND_AUDIT.md](docs/BACKEND_AUDIT.md).

Panel bergambar, pemilihan kondisi, dan sumber animasi: [ENVIRONMENT_VISUALS.md](docs/ENVIRONMENT_VISUALS.md).

- Backend memakai `server/compose.yaml`, hostname Docker `aerosense-api:8080`.
- Web memakai `compose.yaml` di root dan proxy nginx dalam `deploy/nginx.conf`.
- Keduanya berada pada network `n8n_default`.
- Container web baru mendengarkan di `127.0.0.1:8082`, sehingga dashboard lama di port 80 dapat tetap digunakan sampai pengujian selesai.
- Jalur `/api/internal/` ditutup pada proxy publik.

Integrasi produksi memerlukan credential server, akses pengguna Supabase, worker n8n yang aktif, dan pengalihan domain ke container web baru. Build lokal tidak membuktikan layanan produksi sudah terhubung.

## Data publik

Daftar penyedia dan kebutuhannya ada di [PUBLIC_APIS.md](docs/PUBLIC_APIS.md). IQAir memerlukan key. BMKG cuaca memerlukan kode kelurahan. SoilGrids REST sedang tidak tersedia.

Prakiraan dan estimasi wilayah ditampilkan bersama sumber serta waktu datanya. US AQI berbeda dari ISPU. eCO₂ bukan pengukuran CO₂ langsung, dan sinyal debu optik memerlukan validasi sebelum disebut PM2.5. Laporan pemantauan tidak menghitung emisi atau menyatakan kepatuhan ESG.

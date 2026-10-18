# AEROSENSE Dashboard

AEROSENSE dikembangkan untuk pemantauan bersama di sekitar kawasan industri. Web memisahkan pembacaan node, hasil model GRU, dan informasi wilayah dari API publik. AERO-BOT menjelaskan konteks yang tersedia; pekerjaan otomatis memakai backend dan n8n. Kesiapan lapangan mengikuti bukti pengujian tiap jalur.

## Fitur

- Hub lingkungan mengikuti titik node AEROSENSE yang dipilih; berita bencana tetap mencakup Indonesia.
- Kabar bencana Indonesia dari ANTARA dan GDACS, dengan sumber dan tautan bantuan resmi.
- Ringkasan kondisi dan saran singkat tanpa panggilan AI tambahan. Angka serta sumber tersedia pada panel rincian.
- Peta mengikuti koordinat asli setiap node.
- Pembacaan terbaru, historis input, hasil GRU, dan ekspor JSON.
- Chat melalui backend, dengan jawaban dibaca dari job milik pengguna.
- Login Supabase, akses lokasi berdasarkan keanggotaan, dan aturan peringatan untuk operator.
- Laporan lingkungan khusus admin, dengan cakupan data dan batas penggunaan untuk bukti pendukung ESG. Akses diperiksa pada halaman dan endpoint sesuai lokasi.
- Penghubung langganan WhatsApp dan perintah mendengarkan pada layar robot.

Jika sensor belum mengirim data, dashboard menampilkan kondisi kosong. Informasi publik tidak dimasukkan sebagai pembacaan sensor.

## Biaya dan pembeda

Acuan tracker tim 18 Oktober 2026: Rp633.500 untuk lima komponen dasar satu node. Angka ini belum mencakup HPP lengkap, gateway, daya, casing, rakit, uji, instalasi, layanan, dan perawatan. Harga jual belum ditetapkan. Sasaran pengembangan adalah biaya pemantauan per titik yang layak dan gateway bersama; keunggulan biaya membutuhkan perbandingan total biaya pada lingkup dan mutu data yang setara.

[Pembeda, status bukti, biaya, dan batas klaim](docs/POSITIONING_AND_EVIDENCE.md). Laporan tidak memberi skor ESG, menetapkan sumber pencemar, atau menghitung inventaris emisi. Alur pelaporan warga dan tindak lanjut instansi masih dalam pengembangan. Route `/esg-reports` dan endpoint `/v1/esg/report` dipertahankan agar tautan lama tetap berfungsi.

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

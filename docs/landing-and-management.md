# Landing page dan pengelolaan kawasan

## Halaman web

- `/`: halaman publik dengan logo terbaru, maskot Falcon, penjelasan fitur, cara kerja, dan akses pemantauan/masuk.
- `/management`: pemilihan perangkat, ambang waspada/bahaya, batas pulih, jeda notifikasi, serta ekspor konfigurasi.
- `/analytics`: riwayat dan tombol **Unduh CSV** untuk pengguna dengan akses detail pembacaan/model pada lokasi tersebut.

Pengunjung dapat membuka landing page tanpa login. Dashboard dan Hub Lingkungan tetap mengikuti publikasi perangkat dan izin yang sudah berlaku.

## Penugasan pengelola oleh admin

Akun industri atau kader governance menggunakan peran penyimpanan `operator`; label pada web adalah **Pengelola kawasan**. Admin menetapkan keanggotaan berdasarkan lokasi. Pendaftaran biasa tidak memberikan akses pengelola.

Penugasan memakai tabel keanggotaan yang sudah ada. Tidak ada migrasi baru. Saat ini penugasan dilakukan admin melalui Supabase, bukan oleh pengguna dari halaman web.

1. Pengguna mendaftar dan admin memastikan identitas akun yang akan ditugaskan.
2. Admin memeriksa ID lokasi pada tabel perangkat dan UUID akun pada Authentication → Users.
3. Admin menjalankan SQL berikut di Supabase SQL Editor setelah mengganti kedua nilai contoh. Jalankan hanya untuk akun dan lokasi yang telah disetujui.

```sql
insert into public.ae_members (user_id, location_id, role)
values ('GANTI_DENGAN_UUID_AKUN', 'GANTI_DENGAN_ID_LOKASI', 'operator')
on conflict (user_id, location_id) do update set role = excluded.role;
```

4. Pengguna masuk kembali dan membuka **Kelola kawasan**. Perangkat pada lokasi penugasan dapat diedit. Jika akun juga memiliki lokasi lain dengan peran lihat saja, perangkat pada lokasi lain tetap tidak dapat diedit.

Jangan memasukkan service-role key ke browser atau kode frontend. API tetap memeriksa keanggotaan dan hak tulis pada setiap penyimpanan.

## Pengaturan ambang

1. Pilih perangkat dan parameter.
2. Isi batas dengan urutan **batas pulih < waspada < bahaya**.
3. Atur jeda notifikasi 1–1.440 menit dan aktif/nonaktifkan aturan.
4. Tekan **Simpan ambang**. Perubahan berlaku pada evaluasi pembacaan berikutnya; riwayat tidak ditulis ulang.

Aturan disimpan bersama untuk perangkat pada lokasi itu, bukan sebagai preferensi pribadi tiap akun. Admin dan pengelola memiliki hak tulis; warga dan auditor tidak. Parameter PM2.5 hanya dapat diatur jika perangkat memiliki status validasi yang sesuai. Debu optik dan eCO₂ tetap menggunakan nama pengukurannya sendiri.

Ambang ini adalah konfigurasi operasional pengelola, bukan penetapan kepatuhan baku mutu. Menyimpan ambang tidak mengirim perintah langsung ke sprinkler.

## CSV untuk Excel / Google Sheets

**CSV pembacaan** mengikuti perangkat dan kumpulan pembacaan yang telah dimuat halaman, bukan seluruh database. Kolom mencakup waktu UTC/WIB, nama perangkat, lokasi, koordinat, parameter, mutu, dan asal data. Detail model/input mentah mengikuti akses detail lokasi. Nilai yang tidak tersedia dan PM2.5 yang belum tervalidasi tetap kosong.

**CSV ambang** adalah salinan konfigurasi saat ekspor: parameter, satuan, waspada, bahaya, batas pulih, jeda, status aktif, dan waktu ekspor. Berkas ini tidak menyatakan ambang yang berlaku pada setiap pembacaan historis.

CSV memakai UTF-8 dengan BOM, koma sebagai pemisah, baris CRLF, dan pengutipan untuk koma/baris baru. Teks yang dapat dibaca spreadsheet sebagai formula dinetralkan. Buka melalui Data → From Text/CSV di Excel bila pengaturan regional memakai pemisah lain. Di Google Sheets gunakan File → Import → Upload dan pilih pemisah koma.

Ekspor dibuat di browser dari data yang sudah diizinkan API. Tidak ada salinan ekspor baru yang disimpan di Supabase.

## Figma

[AEROSENSE — Landing & Pengelolaan Kawasan](https://www.figma.com/design/W15GLt0MTSi3nwmZuyUYbJ)

- Landing desktop: frame `2:32`.
- Landing mobile: frame `2:33`.
- Kelola kawasan desktop: frame `2:34`.
- Kelola kawasan mobile: frame `2:35`.

Teks, susunan auto-layout, token warna, serta komponen tombol/input dapat diedit. Aset logo, Falcon, dan sensor mengikuti web. Ini adalah file desain, bukan prototype yang menjalankan API. Tangkapan referensi sementara masih ada karena kuota Figma MCP menghentikan pembersihan terakhir; empat frame di atas adalah desain yang disusun untuk disunting.

## Pembaruan server

Fitur ini mengubah frontend dan validasi API. Setelah commit tersedia di remote, jalankan pada Ubuntu server:

```bash
cd ~/AEROSENSE-dashboard
git pull --ff-only origin feat/environment-insights
REVISION=$(git rev-parse HEAD)
bash server/scripts/deploy-update.sh "$REVISION"
docker compose up -d --build web
curl --fail http://127.0.0.1:8082/api/health
```

Script API menggunakan instalasi `~/aerosense-api`, membuat backup lokal, dan mempertahankan konfigurasi Compose serta `.env` yang ada. Pastikan direktori tersebut memang instalasi API aktif pada server. Jangan memindahkan API key ke checkout frontend. Bila struktur pemasangan server berbeda, gunakan proses deploy yang sesuai untuk instalasi itu.

Setelah deploy, periksa landing tanpa login, simpan satu ambang menggunakan pengelola yang telah ditugaskan, lalu coba unduhan CSV. Pengujian lokal/demo dan API dengan database tiruan tidak membuktikan deployment produksi.

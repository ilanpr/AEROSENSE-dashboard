# Demo pengambilan video

Branch: `feat/environment-insights`. Mode build `demo` memakai data sintetis di browser. Tidak memerlukan akun Supabase, kredensial, n8n, atau sensor. Build produksi biasa tetap memakai backend dan otorisasi yang sudah ada; parameter URL tidak bisa mengaktifkan mode demo.

## Jalankan

```powershell
pnpm.cmd install
pnpm.cmd demo:build
pnpm.cmd demo:serve
```

Buka `http://127.0.0.1:4174`. Server hanya menyajikan folder `dist-demo`, terikat pada loopback. Jangan menaruh berkas pribadi atau rahasia dalam folder tersebut.

## Akses tamu

Beranda, node, peta, riwayat, peringatan dan hub lingkungan dapat dibuka tanpa login. Akun diperlukan untuk AERO-BOT, ekspor data, pengaturan dan tindakan pada peringatan. Laporan lingkungan khusus admin. Build demo tidak membuka data produksi.

Untuk produksi, jalankan `server/supabase/007_public_monitoring.sql` dan publikasikan hanya node yang memang ingin ditampilkan melalui `ae_nodes.public_read = true`. Koordinat node yang dipublikasikan akan terlihat oleh pengunjung. Endpoint `/v1/public/*` hanya menerima GET dan membatasi kolom keluaran; data pengguna, gateway, kontak dan metadata proses tidak disertakan. Node lama tetap privat hingga dipilih operator. Migrasi ini belum diterapkan ke server produksi dari sesi ini.

## Akun demo

| Peran | Email | Kata sandi |
| --- | --- | --- |
| Warga | warga@demo.aerosense.test | WargaDemo2026! |
| Admin | admin@demo.aerosense.test | AdminDemo2026! |

Tombol Akun warga/Admin pada form login mengisi email dan password. Tekan Masuk sesudahnya. Akun demo hanya untuk data simulasi di build demo. Warga dapat melihat sensor, peta, analitik, peringatan dan AERO-BOT. Halaman laporan lingkungan tetap khusus admin demo. Pendaftaran dan pengiriman WhatsApp tidak dijalankan.

## Skenario

- 16 titik simulasi tersebar tidak beraturan di kawasan urban Surabaya, dengan jarak antartitik bervariasi. Koordinat tetap saat halaman diperbarui dan konteks lingkungan mengikuti titik terpilih. Titik tidak mewakili pemasangan atau industri tertentu.
- 15 node menampilkan contoh data baru, satu node menampilkan keterlambatan 45 menit. Waktu skenario disusun terhadap waktu perangkat saat membuka demo; ini bukan waktu pengukuran nyata.
- Tiap node mempunyai 96 sampel berjarak 15 menit, mendekati 24 jam. Suhu, kelembapan, TVOC, eCO2 dan debu optik bervariasi secara halus antarwaktu dan titik.
- Garis GRU adalah ilustrasi, dengan versi `demo-illustration-not-inference`; bukan hasil inferensi atau bukti peningkatan akurasi.
- Ambang debu 40 (waspada) dan 60 (bahaya) adalah aturan skenario, bukan baku mutu/kategori kesehatan. Dua node memiliki skenario debu lebih tinggi; data sintetis ini bukan bukti polusi di lokasi sebenarnya. Ada contoh peringatan dan status ditinjau. Sumber pencemar tidak ditetapkan.
- Hub lingkungan memakai nilai contoh Surabaya pada koordinat node pilihan: cuaca, udara wilayah, tanah, titik panas, sungai dan cakupan gempa. Label penyedia memakai “simulasi”; tidak ada fetch API publik langsung.
- Berita bencana tidak diisi dengan kejadian rekaan. Kanal PMI/BNPB tetap menuju sumber resminya.
- AERO-BOT menyediakan jawaban contoh untuk cuaca, udara, sensor, tanah, karhutla dan ESG. Tidak memanggil Gemini atau n8n. Pertanyaan di luar contoh mendapat penjelasan cakupan demo.
- Perubahan status/percakapan hanya tersimpan pada sesi browser, bukan database produksi. Banner data simulasi tetap terlihat saat direkam.

## Akses HP dari jaringan berbeda

Jalankan tunnel sementara hanya ke server demo:

```powershell
cloudflared tunnel --url http://127.0.0.1:4174
```

Buka URL HTTPS `trycloudflare.com` yang tercetak pada HP, lalu pakai akun warga. Setiap restart tunnel menghasilkan alamat baru. Laptop, server demo, proses tunnel dan internet harus tetap menyala saat take. Ini akses sementara, tanpa jaminan uptime.

Rujukan: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/

## Urutan rekaman singkat

1. Buka Beranda tanpa login dan pilih beberapa node. Masuk akun warga saat merekam fitur AERO-BOT.
2. Buka Peta sensor untuk memperlihatkan sebaran 16 titik.
3. Buka Riwayat & model, ganti parameter/node, dan sorot input mentah serta ilustrasi GRU.
4. Buka Peringatan pada node bernilai tinggi, lalu hub lingkungan dan sumbernya.
5. Tanya “Cuaca di Surabaya?” atau “Bagaimana kondisi udara node ini?” di AERO-BOT.
6. Untuk rekaman laporan, masuk akun admin pada browser/sesi terpisah. Jangan menyajikan demo sebagai hasil pengujian alat atau respons instansi nyata.


## Status node dan ilustrasi

Status yang sama dipakai pada beranda, strip node, detail, tabel dan peta. Hanya pembacaan indikator udara sensor yang dibandingkan dengan aturan aktif; data API wilayah tidak menentukan status node. Data lama, aturan kosong, atau parameter tidak valid tidak diberi label bersih. Histeresis mengikuti `clear_below`; label bahaya hanya tersedia bila `danger_high` diatur operator.

Untuk backend produksi, terapkan `server/supabase/008_node_status_bands.sql` sebelum memperbarui backend. Atur ambang melalui Pengaturan. Migrasi tidak memasang ambang kesehatan default, tidak mengubah workflow notifikasi menjadi laporan darurat, dan tidak diterapkan ke database produksi dari sesi ini.

Tiga pose AERO-BOT dibuat dengan ImageGen bawaan, memakai maskot asli sebagai referensi: memberi saran (`calm.png`), memeriksa data (`watch.png`), dan memberi perhatian (`alert.png`). File final berada di `public/assets/aerobot/`. Prompt: pertahankan tubuh putih-biru, layar wajah navy, mata cyan, sirip telinga dan emblem angin; ilustrasi 2D transparan seluruh tubuh; ubah pose sesuai status; tanpa teks atau latar. Ketiganya ditampilkan pada kartu saran sesuai pembacaan node; pose memeriksa data juga ada di halaman AERO-BOT.

Build demo mempertahankan berkas JavaScript versi sebelumnya selama take agar tab yang sudah terbuka tetap bisa berpindah halaman. Bersihkan folder build hanya di antara sesi saat server demo berhenti. Jika tab masih menampilkan error dari build lama, tekan Muat ulang.

Tampilan memakai font Sora variabel yang disimpan lokal (Google Fonts, lisensi OFL), kartu metrik kaca biru transparan dengan angka putih, satu judul status dan rekomendasi singkat. Sebaran tidak beraturan hanya berlaku pada titik simulasi; koordinat perangkat produksi tidak diubah.


Font antarmuka: Sora variabel lokal (`public/fonts/sora/Sora-Variable.ttf`, lisensi OFL). Judul dan angka 750, tombol 700, navigasi 600, teks pendukung 450.

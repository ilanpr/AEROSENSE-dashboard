# Hasil pemeriksaan integrasi

Pemeriksaan pada 16 Oktober 2026.

## Lulus

- Build TypeScript dan Vite.
- Delapan pengujian Node: autentikasi perangkat, batas akses node, idempotensi job, signature Meta, validasi telemetry, lease, respons model, format audio, konfigurasi publik, pemisahan cache berdasarkan koordinat dan hasil chat milik akun.
- Lint pada source baru dan yang diubah. Lint seluruh repositori menyisakan empat peringatan Fast Refresh pada komponen bawaan yang tidak diubah.
- Pemeriksaan desain otomatis pada hub, chat, workspace sensor dan stylesheet tidak menemukan masalah.
- Uji browser lokal: login, kategori cuaca/udara, kondisi sensor tanpa pembacaan, serta pertanyaan yang menghasilkan job dan jawaban.
- Pemeriksaan desktop dan ponsel. Overflow header ponsel diperbaiki; pemeriksaan berikutnya tidak menemukan overflow horizontal.
- Bundle frontend tidak mengandung credential pengujian server.

## Batas pengujian

Uji browser menggunakan server fixture lokal dan data sintetis. Jawaban pada pengujian tersebut bukan panggilan Gemini langsung. Pengujian HTTP memeriksa kontrak backend dengan Supabase pengujian dalam proses, bukan database produksi.

Docker Desktop lokal tidak berjalan. Image Docker, resolusi hostname aerosense-api pada network server, proxy nginx, Cloudflare Tunnel, dan login Supabase produksi perlu diuji pada server.

Perubahan ini belum dipasang pada aerosense.me. Tidak ada credential produksi yang dimasukkan ke repositori. Tidak ada perubahan koordinat node sensor atau pengisian data contoh ke database produksi.

Perangkat infrared, mikrofon, speaker, agent mini PC, dan pengiriman WhatsApp memerlukan uji perangkat serta credential masing-masing. Hub publik masih bergantung pada ketersediaan penyedia: IQAir menunggu key, BMKG cuaca menunggu kode kelurahan, dan REST SoilGrids sedang dihentikan sementara.


## Pembaruan 18 Oktober 2026

- 21 pengujian otomatis lulus, termasuk filter berita Indonesia, penolakan XML berbahaya, cache saat sumber gagal, konteks worker dan validasi referensi nasional.
- Build TypeScript/Vite lulus. Lint menyisakan empat peringatan Fast Refresh bawaan.
- Tampilan hub diperiksa pada lebar 1280 dan 390 piksel tanpa overflow halaman. Jarak kotak angka ke bawah panel 24 piksel. Filter karhutla hanya menampilkan kartu bertipe karhutla.
- Kartu promosi AERO-BOT dihapus; halaman chat memakai label dan sumber yang singkat.
- Feed ANTARA/GDACS diambil langsung untuk berita Indonesia; sensor dan cuaca pratinjau tetap sintetis.
- Migrasi 005 dibuat di Supabase. Migrasi 006 perlu diterapkan agar cache publik mengikuti koordinat node; sampai migrasi dan jadwal Hub dipublikasikan, pembaruan dinamis belum aktif di produksi.
- Draft Hub, Web, Robot dan WhatsApp di n8n diperbarui melalui UI lalu diekspor kembali untuk memeriksa hasil simpan.
- Backend Ubuntu belum diperbarui karena login SSH otomatis ditolak. Pengiriman WhatsApp, perangkat fisik dan jalur produksi dari domain belum diuji sampai akhir.

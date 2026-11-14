# AEROSENSE WhatsApp via GOWA

Transport prototipe menggunakan [GOWA v9.6.0](https://github.com/aldinokemal/go-whatsapp-web-multidevice/releases/tag/v9.6.0). GOWA memakai perangkat tertaut WhatsApp dan bukan layanan resmi Meta. Keberhasilan API menerima pesan belum berarti pesan diterima atau dibaca.

## Alur

1. WhatsApp Business menerima pesan, GOWA mengirim webhook bertanda tangan HMAC ke backend melalui jaringan Docker `n8n_default`.
2. Backend memeriksa akun perangkat, jenis chat, waktu, tanda tangan dan ID pesan. Chat grup, status, pesan sendiri, serta LID tanpa nomor terurai tidak diterima.
3. `wa_inbox` disimpan sekali berdasarkan ID pesan dan akun. Worker WhatsApp di n8n menangani menu, DAFTAR, BERHENTI, akses node, dan pertanyaan AERO-BOT.
4. `wa_send` diperiksa ulang terhadap kontak, persetujuan notifikasi, node aktif dan membership sebelum backend memanggil GOWA.
5. ID kirim disimpan sebelum job diselesaikan. Webhook delivered/read/played disimpan secara monotonic di `ae_wa_receipts` dan tidak turun oleh callback terlambat.

Menu memakai pilihan angka yang ditampilkan pada pesan. `0` selalu membuka menu. Angka mengikuti menu balasan terakhir untuk nomor pengirim yang sama (maksimal 24 jam); nomor lokasi atau pilihan notifikasi tidak tertukar dengan nomor menu utama. Perintah lama seperti `kondisi`, `lokasi`, `riwayat`, `grafik`, `ringkasan`, `tanya aerobot`, `notifikasi`, `node node-01`, dan `BERHENTI` tetap diterima.

Sapaan `Halo`, `Hai`, `Mulai`, `Selamat pagi` dan `Assalamualaikum` langsung membuka menu melalui aturan lokal, tanpa Gemini. Pertanyaan biasa tetap masuk jalur AERO-BOT dan balasannya memuat cara kembali ke menu. Persetujuan langganan tetap terpisah: membuka chat atau memilih menu tidak membuat subscription.

Web menyediakan tombol **Chat lewat WhatsApp** pada AERO-BOT dan Peringatan, juga untuk guest. Popup menjelaskan bahwa pesan `Mulai` sudah terisi dan pengguna harus menekan Kirim di WhatsApp. Kode pairing memiliki tombol pembuka chat tersendiri dengan persetujuan notifikasi yang terlihat sebelum keluar dari web. `VITE_WHATSAPP_NUMBER` mengatur nomor publik, dengan kontak AEROSENSE dari brief sebagai default. Pratinjau demo menjelaskan bahwa chat WhatsApp nyata sedangkan data web tetap simulasi.

Popup ini berada di web. GOWA v9.6.0 tidak menyediakan endpoint menu persisten/Reply Keyboard seperti Telegram; teks bernomor tidak diklaim sebagai tombol native WhatsApp. Format font dan bubble tetap mengikuti aplikasi WhatsApp. Klik [tautan wa.me](https://faq.whatsapp.com/5913398998672934) mengisi pesan, bukan mengirim otomatis.

## Respons AI cepat (20 Oktober 2026)

Worker WhatsApp memakai `models/gemini-3.1-flash-lite` untuk satu respons JSON, dengan validator sensor dan sumber yang sama. Sebelum memanggil model, query `n8n/whatsapp-conversation.sql` mengantrekan **Pertanyaan sedang diproses.** melalui jalur `wa_send` yang sudah ada. Kunci `progress:<job_id>` mencegah duplikasi saat retry. Job lama lebih dari dua menit dan job yang sudah memiliki balasan akhir tidak membuat pesan proses baru. Notifikasi ini bukan persetujuan berlangganan dan tidak membuka akses node.

Untuk mereproduksi konfigurasi dari ekspor operator terbaru:

```bash
node scripts/build-whatsapp-fast.mjs whatsapp-export.json whatsapp-fast.json
```

Hasil ekspor dibuat tidak aktif; periksa dan publikasikan melalui n8n. Simpan ekspor yang berisi referensi kredensial di luar Git. Tidak membutuhkan perubahan skema, pembaruan container API, atau pairing ulang GOWA.

Pengujian model melalui n8n dengan tiga input sintetis (tips polusi, referensi suhu/eCO2, dan penolakan instruksi meretas) lolos validator yang sama. Uji penuh ulang selesai 4,410 detik, dengan tahap Gemini 3,786 detik untuk tiga item. Ini pengukuran uji terisolasi, bukan jaminan latensi WhatsApp produksi. Query diperiksa menggunakan PostgreSQL EXPLAIN tanpa menjalankan perubahan datanya. Layanan model, antrean, dan pengiriman WhatsApp tetap dapat menambah waktu tunggu.

Koreksi produksi: gunakan pilihan model tetap (`mode: list`), bukan editor ekspresi. Ekspor produksi versi `23ce7cc3-6c3e-40af-9d60-6c4cb6618048` sudah diperiksa: nilai model persis `models/gemini-3.1-flash-lite` dan query pesan proses terpasang. Uji WhatsApp nyata pukul 09.52 WIB, 20 Oktober 2026, menghasilkan jawaban sah pada log n8n pukul 09.52: tahap percakapan selesai 4,245 detik, lalu GOWA menerima balasan akhir dalam 1,019 detik. Penerimaan GOWA tidak membuktikan delivered/read pada HP.

## Yang sudah diverifikasi pada 19 Oktober 2026

- Image tag v9.6.0 tersedia di GHCR; kontrak payload diperiksa terhadap dokumentasi versi tersebut.
- 38 pengujian backend lulus, termasuk verifikasi signature, deduplikasi inbox, opt-out, menu, pemulihan stage dan respons pengiriman ambigu.
- Compose lolos pemeriksaan konfigurasi; Bash pemasangan lolos pemeriksaan sintaks.
- Migrasi `010_gowa_receipts.sql` sudah diterapkan pada Supabase AEROSENSE `kuprcqvnyayrbsckiqrm`. Uji read lalu sent mempertahankan read, RLS aktif, anon/authenticated tidak bisa menjalankan RPC, service_role bisa. Transaksi uji di-rollback, tidak menyisakan baris.
- Workflow `AEROSENSE | WhatsApp`, ID `ddNDGrNx3Pi4SrZ2`, sudah dipublikasikan dengan 28 node. Control Center, Data udara, Jawaban website dan AERO-BOT juga sudah dipublikasikan; versi n8n ini mensyaratkan semua child workflow yang dirujuk dipublikasikan sebelum dispatcher dapat aktif.
- Pengguna mengonfirmasi hasil bind: provider gowa, linked/bound/receipt_schema_ready semuanya true. SSH otomatis masih ditolak autentikasi, sehingga pemasangan dijalankan pengguna melalui terminal sendiri.
- Uji `menu` langsung pada 19 Oktober pukul 19.30 WIB menghasilkan satu `wa_inbox` done dan satu `wa_send` done tanpa last_error; masing-masing satu percobaan. Eksekusi n8n inbox dan kirim berhasil. Receipt yang saat diperiksa tersimpan adalah sent, belum menjadi bukti delivered/read atau penerimaan di HP.
- Adapter receipt sudah diperbaiki untuk chat_id LID dengan pengirim PN yang sudah diurai oleh GOWA. Nomor hanya diambil dari field from yang valid pada receipt chat privat; LID tidak diubah menjadi nomor dan grup tetap ditolak. Perubahan ini memerlukan pembaruan backend; receipt yang sebelumnya terlewat tidak dijamin dikirim ulang oleh gateway.

## Pasang di Ubuntu

Jalankan melalui terminal SSH sebagai `aiot4`. Backend ada di `~/aerosense-api`. Gunakan SHA rilis integrasi yang diberikan di chat; jangan memakai contoh SHA dari rilis lama.

```bash
curl -fL "https://raw.githubusercontent.com/ilanpr/AEROSENSE-dashboard/COMMIT_SHA/server/scripts/deploy-update.sh" -o /tmp/aerosense-deploy-update.sh
bash /tmp/aerosense-deploy-update.sh COMMIT_SHA
cd ~/aerosense-api
bash scripts/setup-gowa.sh install
```

Installer membuat `.env.gowa` dengan kredensial acak, menyalinnya ke `.env` backend, membuat slot perangkat `aerosense`, dan menjalankan GOWA. File `.env` dicadangkan sebelum perubahan. Transport baru diaktifkan setelah langkah bind, bukan saat instalasi awal. `.env.gowa` jangan dimasukkan Git atau dikirim ke chat.

Jika pemasangan versi awal berhenti dengan `Device lookup failed: HTTP 500`, perbarui skrip `setup-gowa.sh`, `ensure-gowa-device.mjs`, dan `wait-api.sh` dari commit perbaikan, lalu jalankan `bash scripts/setup-gowa.sh resume`. Mode resume memakai container dan kredensial yang sudah ada. GOWA v9.6.0 mengembalikan error generik untuk pencarian slot yang belum dibuat; skrip sekarang memeriksa daftar perangkat, termasuk respons `results: null`, sebelum membuat slot. Pemeriksaan API juga menunggu JSON health yang valid ketika koneksi awal masih reset.

### Buka dashboard dan tautkan HP

Di PowerShell laptop buka terminal terpisah:

```powershell
ssh -N -L 3001:127.0.0.1:3001 aiot4@100.84.156.202
```

Biarkan terminal tersebut terbuka. Buka `http://localhost:3001` di browser laptop. Jika port laptop sudah dipakai, gunakan `-L 3002:127.0.0.1:3001`, lalu buka localhost:3002.

Username dashboard: `aerosense`. Untuk menampilkan password di terminal Ubuntu Anda sendiri:

```bash
sed -n 's/^GOWA_BASIC_AUTH=aerosense://p' ~/aerosense-api/.env.gowa
```

Pilih slot `aerosense` di dashboard GOWA, tampilkan QR, lalu pindai dari **WhatsApp Business → Perangkat tertaut → Tautkan perangkat**. QR dan kode SMS tidak perlu dikirim ke chat.

Setelah status perangkat connected/logged in:

```bash
cd ~/aerosense-api
bash scripts/setup-gowa.sh bind
bash scripts/setup-gowa.sh check
```

Hasil yang diharapkan: `provider=gowa`, `linked=true`, `bound=true`, `receipt_schema_ready=true`. `linked=true` hanya membuktikan sesi perangkat, bukan penerimaan pesan.

## Aktifkan dan uji alur

Setelah pemeriksaan di atas berhasil:

1. Pastikan WhatsApp dan Control Center published. Keduanya sudah diaktifkan pada 19 Oktober 2026; audit sebelum integrasi GOWA tidak lagi menggambarkan status aktivasi saat ini. Dispatcher menerima event Supabase dan memiliki jadwal pemulihan antrean.
2. Dari nomor lain yang Anda kendalikan, kirim `menu` ke nomor WhatsApp Business baru. Pastikan `wa_inbox` diproses, `wa_send` selesai dan balasannya terlihat di HP.
3. Hubungkan pengguna melalui kode `DAFTAR <kode>` dari web agar akses node dan persetujuan notifikasinya sah. Kode berlaku 10 menit. Menu tidak membuka node privat tanpa membership.
4. Uji `kondisi`, pilihan node dan `BERHENTI`; pastikan subscription menjadi tidak aktif dan alert berikutnya tidak terkirim. Uji alert hanya dengan node/aturan uji dan penerima yang menyetujui.
5. Periksa `ae_wa_receipts` untuk delivered/read. Privasi penerima dapat memengaruhi ketersediaan read receipt.
6. Aktifkan jadwal maintenance yang sudah ada agar receipt lebih dari 30 hari dibersihkan. Penghapusan ini menyasar status transport, bukan data sensor.

Catatan audit terpisah: domain produksi `aerosense.me/api/*` sebelumnya membalas HTML frontend walaupun HTTP 200. Pairing web produksi memerlukan proxy API mengembalikan JSON. Pemasangan GOWA tidak memperbaiki proxy Nginx secara otomatis. Preview dengan data simulasi juga bukan bukti data node asli mengalir.

## Kegagalan dan pengulangan

GOWA tidak mendokumentasikan idempotency key klien untuk `/send/message`. Jika timeout, koneksi putus, respons 5xx, atau proses mati setelah percobaan tetapi sebelum ID disimpan, backend **tidak mengirim ulang secara buta**. Job ditandai `failed` dengan `delivery_unknown=true` saat diproses kembali. Operator perlu memeriksa pesan di gateway/WhatsApp sebelum membuat percobaan baru. Tidak ada klaim exactly-once.

Penolakan HTTP yang definitif seperti 400/401/403/404/422/429 melewati retry antrean yang sudah ada. Periksa autentikasi dan status sesi; hindari mengulang kegagalan permanen tanpa memperbaiki penyebabnya.

Jika sesi keluar, buka kembali dashboard melalui SSH forwarding dan tautkan ulang slot yang sama. Volume sesi disimpan di Docker; jangan memakai `down -v` saat pembaruan. Dashboard hanya terikat di loopback Ubuntu.

## Membuat ulang draft dari ekspor n8n terbaru

```powershell
node scripts/build-gowa-workflow.mjs "C:/path/WhatsApp-export.json" "C:/path/whatsapp-gowa.json"
```

Generator mempertahankan referensi credential PostgreSQL/Gemini/internal API, menghapus trigger dan pengiriman Meta, serta mengganti send menjadi endpoint backend GOWA. Ekspor yang berisi referensi credential tetap lokal; tidak perlu memasang community node n8n. Backup ekspor sebelum perubahan ada di Downloads `AEROSENSE _ WhatsApp (10).json`.

Import n8n menambahkan node ke canvas. Untuk mengganti draft, cadangkan dahulu, kosongkan canvas, lalu paste/import hasil generator dan simpan. Jangan mengimpor di atas node lama sehingga menjadi dua alur.

## Sumber kontrak

- [Dokumentasi webhook v9.6.0](https://github.com/aldinokemal/go-whatsapp-web-multidevice/blob/v9.6.0/docs/webhook-payload.md)
- [OpenAPI v9.6.0](https://github.com/aldinokemal/go-whatsapp-web-multidevice/blob/v9.6.0/docs/openapi.yaml)
- [Rilis GOWA](https://github.com/aldinokemal/go-whatsapp-web-multidevice/releases/tag/v9.6.0)

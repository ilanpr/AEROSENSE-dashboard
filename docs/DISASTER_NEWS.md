# Kabar bencana Indonesia

## Yang ditampilkan

Judul, lokasi, tanggal, sumber dan angka yang memang tersedia. Berita ANTARA didahulukan; notifikasi model GDACS tampil sebagai pelengkap. Pengunjung dapat memfilter karhutla, banjir dan gempa. Tautan bantuan menuju PMI dan BNPB.

Data lingkungan mengikuti koordinat node yang dipilih. Berita bencana mencakup Indonesia dan tidak dimasukkan ke pembacaan sensor, GRU, atau dataset pelatihan.

## Sumber tanpa API key

| Sumber | URL | Batas data |
|---|---|---|
| ANTARA terkini | https://www.antaranews.com/rss/terkini.xml | Berita dengan judul bencana dan lokasi Indonesia yang dikenali |
| ANTARA humaniora | https://www.antaranews.com/rss/humaniora.xml | Filter yang sama; feed dapat berisi artikel lama |
| GDACS | https://www.gdacs.org/xml/rss.xml | Hanya notifikasi berkode negara IDN |

Direktori resmi: [RSS ANTARA](https://www.antaranews.com/rss), [GDACS feeds](https://data.gdacs.org/feed_reference.aspx).

ANTARA tidak dipakai untuk menyalin artikel penuh. Backend menyimpan judul, metadata dan tautan sumber. Filter lokasi bersifat konservatif: berita dengan lokasi ambigu tidak tampil. Cakupannya bukan seluruh kejadian Indonesia.

GDACS dapat memperbarui notifikasi untuk peristiwa yang sudah dimulai sebelumnya. Tanggal pembaruan dan awal pantauan dibedakan. Luas hektare merupakan estimasi model, bukan luas terbakar terkonfirmasi. Angka antarperistiwa tidak dijumlahkan. Data populasi model tidak dijadikan angka korban.

## Alur backend

```text
Backend mulai + setiap 15 menit
  → ANTARA / GDACS
  → cek format, negara, waktu dan tautan
  → ae_disaster_news_cache di Supabase
  → GET /v1/disasters
  → kartu berita di web
```

Tidak ada workflow n8n baru untuk polling berita. Satu timer backend memperbarui cache bersama sehingga trafik pengguna tidak menggandakan panggilan feed atau memakai token Gemini. Panggilan bersamaan dalam proses yang sama digabungkan.

Cache menyimpan satu baris per feed: provider, items, last_attempt_at, last_success_at, refresh_after dan last_error. Setiap pengambilan memangkas item lebih lama dari tujuh hari, termasuk saat feed gagal. Akses langsung hanya untuk service-role backend; browser memakai endpoint publik yang sudah disaring. Daftar dibatasi 24 item. Cache bukan arsip berita yang terus membesar.

## Cache lokasi node

Migrasi `006_robot_environment_locations.sql` membuat satu area lingkungan per node dari koordinat `ae_nodes`. Saat lokasi berubah, cache lama untuk node itu dihapus dan pengambilan berikutnya memakai koordinat baru. Saat node dimatikan, cache titik tersebut dihapus. Tabel cache memakai kunci gabungan area dan penyedia, jadi pembaruan menimpa baris lama. Penghapusan node menghapus area beserta cache lewat foreign key.

Jika sumber gagal, hasil terakhir dipertahankan dan diberi status tertunda setelah satu jam. Item melewati tujuh hari tidak tampil. Respons dibatasi 1,5 MB, timeout 12 detik per feed, URL sumber tetap, dan XML DTD/entity ditolak.

## Konteks AERO-BOT

Untuk pertanyaan tentang berita, karhutla atau bencana Indonesia, `/internal/chat/native-refresh` menambahkan maksimal tiga referensi berita yang masih segar. Node `Siapkan konteks hub Web`, `Siapkan konteks hub Robot`, dan `Siapkan konteks hub WhatsApp` menggabungkannya dengan konteks yang sudah ada.

Gemini tetap menilai pertanyaan dan menjawab dalam satu respons. Node validasi mencocokkan ID referensi, cakupan Indonesia dan waktu berlaku, lalu menambahkan judul, tanggal serta sumber. Data nasional tidak disebut kejadian Surabaya tanpa sumber yang mendukung. Teks feed diperlakukan sebagai data, bukan instruksi.

Pertanyaan sensor biasa tidak mengambil konteks berita. Jika cache berita belum tersedia, pemrosesan pertanyaan sensor tetap dapat berjalan.

## Pemasangan

1. Jalankan `server/supabase/005_disaster_news.sql`. Migrasi ini sudah dijalankan pada proyek Supabase AEROSENSE pada 18 Oktober 2026.
2. Perbarui source backend dan build ulang container. Pertahankan `.env` yang sudah ada.
3. `DISASTER_NEWS_ENABLED=true` mengaktifkan timer. HTTPS keluar ke ANTARA dan GDACS harus tersedia.
4. Periksa `GET /v1/disasters` setelah backend mulai. Cache kosong sebelum pengambilan pertama bukan bukti kegagalan migrasi.
5. Deploy frontend, lalu buka bagian Kabar bencana Indonesia.

Kunci baru tidak diperlukan. n8n tetap memakai credential internal yang sudah ada. Memublikasikan frontend tidak memperbarui backend atau mengaktifkan jadwal n8n.

## Bantuan

- [Donasi PMI](https://donasi.pmi.or.id/donation/monetary/donate-now): dukungan kemanusiaan melalui kanal resmi, bukan kampanye spesifik yang diasumsikan aktif.
- [BNPB](https://www.bnpb.go.id/): pembaruan resmi dan arahan penanganan. Relawan berkoordinasi dengan BNPB/BPBD/PMI sebelum berangkat.

## Pemeriksaan

`pnpm test` mencakup filter negara, feed lama, waktu masa depan, URL berbahaya, XML tidak valid, cache saat gangguan, permintaan bersamaan, pemisahan lokasi dan validasi referensi n8n.

Untuk pratinjau berita asli dengan sensor dan cuaca sintetis, jalankan fixture dengan `PREVIEW_LIVE_NEWS=true`. Mode ini hanya menyimpan feed publik di memori lokal. Jangan gunakan fixture sebagai backend produksi.

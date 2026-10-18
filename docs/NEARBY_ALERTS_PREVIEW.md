# Peringatan sekitar: preview sebelum pembaruan backend

## Perubahan tampilan

- `/alerts` menggunakan lokasi perangkat dari tombol **Gunakan lokasi saya**, bukan node yang dipilih di halaman lain.
- Radius 2,5 / 5 / 10 km dihitung garis lurus di peramban. Node bahaya dan waspada didahulukan; di dalam status yang sama, node terdekat lebih dulu.
- Produksi membaca node yang diterbitkan pengelola melalui `/v1/public/dashboard`, termasuk pembacaan dan aturan sensor. Izin admin tidak diberikan oleh geolokasi.
- GPS tidak dikirim ke server AEROSENSE, tidak disimpan di Supabase/local storage, dan tidak diminta otomatis saat halaman dibuka. Peta tetap memuat tile OpenStreetMap.
- Build demo mulai dari **Lokasi contoh · Surabaya**, bukan GPS pengguna. Pengguna bisa menggantinya dengan lokasi perangkat. Lokasi yang ditolak atau tidak ditemukan tidak diganti diam-diam dengan Surabaya.
- Node tanpa data baru/valid tidak diberi status bersih. Radius tanpa node tidak ditafsirkan sebagai udara aman.
- Kartu dan popup menampilkan debu optik (PM2.5 hanya bila tervalidasi), eCO₂, suhu dan waktu pembacaan. Detail lengkap tetap tersedia melalui tautan node.

## Hasil pemeriksaan kode backend

1. Halaman lama menggunakan `SensorWorkspace mode="alerts"`; query `/v1/alerts?node_id=...` memuat riwayat satu node. Halaman baru memakai pembacaan terkini semua node publik yang berada dalam radius pengguna, tanpa mengubah riwayat peringatan untuk operator.
2. `/v1/public/dashboard` sudah mengirim lokasi, `latest`, ambang `high`, `danger_high`, `clear_below` dan status `active`. Publikasi tetap dibatasi `public_read=true` dan `enabled=true`. Tidak perlu menyimpan GPS pengguna untuk menghitung jarak.
3. Preview yang dibagikan merupakan build demo. `src/demo/api.ts` sengaja mengembalikan `items: []` untuk `/v1/disasters`; ini bukan hasil pengecekan kondisi bencana saat ini. Empty state sekarang menjelaskan batas tersebut.
4. Backend berita produksi (`server/api/disaster-news.mjs`) membaca ANTARA humaniora, ANTARA terkini dan GDACS, dengan filter Indonesia dan jendela 7 hari. RSS terkini bukan arsip lengkap; headline yang tidak cocok dengan daftar lokasi/jenis kejadian dapat tersaring. Belum ada bukti bahwa feed produksi saat ini mencakup karhutla yang dimaksud pengguna.
5. `server/api/server.mjs` menjadwalkan refresh berita pada startup dan setiap 15 menit, kecuali `DISASTER_NEWS_ENABLED=false`. Frontend membaca setiap 5 menit. Penyimpanan memakai cache Supabase (`005_disaster_news.sql`). Status Docker, migrasi, outbound HTTPS, jam server dan isi cache produksi belum diverifikasi pada tahap preview ini.

## Tahap berikutnya setelah pengguna melihat preview

- Periksa hasil live setiap sumber, tanggal publikasi, batas feed dan filter lokasi, lalu pastikan sumber karhutla Indonesia yang benar-benar terverifikasi masuk ke cache.
- Bedakan cache kosong, sumber gagal dan tidak ada hasil filter; jangan mengubah kegagalan sumber menjadi kesimpulan tidak ada bencana.
- Pertahankan tanggal, sumber, negara Indonesia, jenis berita/pantauan, retensi terbatas dan deduplikasi. Jangan menambahkan kejadian dummy sebagai berita terkini.
- Uji deployment produksi lewat jalur API/nginx/Docker dan workflow n8n yang digunakan server; perubahan repo atau preview tidak membuktikan backend produksi telah diperbarui.

Tidak ada perubahan backend/n8n/Supabase produksi pada tahap ini, sesuai permintaan untuk melihat tampilan terlebih dahulu.

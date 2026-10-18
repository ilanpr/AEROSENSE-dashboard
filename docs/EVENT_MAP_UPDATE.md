# Pembaruan lokasi kejadian publik

## Kontrak

Hub n8n menyimpan `payload.events` dan `payload.event_coverage` pada cache JSONB yang sudah ada. Tidak membuat tabel historis baru. Satu baris per lokasi dan penyedia ditimpa saat berhasil; kegagalan sumber mempertahankan data terakhir, beserta waktu lamanya.

- FIRMS: koordinat pusat piksel, waktu UTC, satelit dan confidence; hasil 24 jam dalam 50 km. Maksimum 200 titik terbaru per area, jumlah total dan flag `truncated` tetap disimpan. Bukan jumlah kebakaran terkonfirmasi.
- BMKG: koordinat episenter, waktu, magnitudo, kedalaman dan informasi sumber; feed terakhir M5+ dibatasi tujuh hari dan 300 km. Maksimum 30 entri per area. Bukan seluruh gempa dan bukan radius dampak.
- API web memeriksa kembali koordinat area, kategori/provider, waktu, lokasi, batas jumlah dan sumber. Perubahan lokasi robot tidak memakai cache titik lama.
- Data lebih dari dua jam sejak pengambilan terakhir ditandai stale, bukan diberi waktu baru. Titik panas lebih dari 24 jam dan gempa lebih dari tujuh hari tidak ditampilkan.
- Pilihan peta: sensor saja, sensor dan kejadian, kejadian publik. Ikon antena untuk sensor, api untuk titik panas, gelombang untuk episenter gempa. Peta tidak mengubah status node berdasarkan API publik.

## Berita

Feed tetap GDACS + ANTARA humaniora + ANTARA terkini, tanpa kejadian rekaan. Filter Indonesia mengenali Hulu Sungai dan sejumlah gunung Indonesia. Artikel yang masih berumur kurang dari tujuh hari dipertahankan ketika terlepas dari feed RSS singkat; deduplikasi URL, maksimum 40 per sumber dan 24 pada API tetap berlaku. Cache kosong dan sumber gagal memiliki status berbeda.

## Preview publik

`scripts/serve-demo.mjs` melayani dua endpoint read-only yang hanya mengambil sumber publik tetap: `/demo-public/disasters` dan `/demo-public/environment?node_id=...`. Node ID dibatasi pada daftar 16 lokasi demo; tidak menerima URL bebas atau kredensial. Sensor, cuaca, udara dan tanah demo tetap sintetis. Titik panas, gempa dan berita berasal dari feed sumber, dengan timestamp dan atribusi. Gangguan feed tidak diganti dengan titik dummy.

## Pemasangan Ubuntu

Script `server/scripts/deploy-update.sh` menerima SHA commit lengkap, mengunduh arsip publik pada revisi itu, membuat backup lokal, memperbarui API dan scripts, lalu membangun ulang container API. `.env`, Compose, jaringan, volume dan credential tidak diganti. Tidak menjalankan migrasi atau penghapusan data sensor.

Database live diperiksa melalui SQL Editor: kolom `source_node_id` belum tersedia dan planner hanya menerima `city_reference`, sehingga tidak menghasilkan permintaan. Perbaikan `009_live_location_compatibility.sql` sudah diterapkan: dua area mengikuti node asli; lokasi kota lama dinonaktifkan secara reversibel, cache lama dipertahankan, dan kolom `public_read` tetap false untuk node yang belum dipublikasikan. Kolom `danger_high` ditambahkan tanpa mengisi ambang. Workflow kemudian menghasilkan 10 pembaruan cache. Dua node produksi saat pemeriksaan memiliki koordinat yang sama; koordinat tersebut tidak diubah menjadi titik demo.

Setelah pemasangan jalankan `docker compose exec -T aerosense-api node scripts/check-environment.mjs`. Hasil wajib menunjukkan revisi yang dipasang, kontrak `events`/`event_layers`, status sumber, dan jumlah berita Karhutla. HTTP 200 saja belum membuktikan ada cakupan kejadian.

Workflow live yang diubah lewat browser: `https://flow.aerosense.me/workflow/lTIFDJVNLP6QKNUN`. Konektor n8n terhubung ke salinan berbeda (`8u1xYKkuWCN8MBDH`), sehingga tidak digunakan untuk mengubah workflow live. Backup kode sebelum perubahan disimpan di artefak lokal, bukan dipublikasikan.

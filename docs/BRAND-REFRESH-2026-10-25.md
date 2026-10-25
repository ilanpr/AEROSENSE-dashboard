# Pembaruan ilustrasi AEROSENSE — 25 Oktober 2026

## Aset

- Maskot: ilustrasi asli dari **Falcon Gemastik Aerosense.ai** milik pengguna. Tujuh pose diekspor dari artboard PDF yang tertanam, tanpa menggambar ulang karakter. WebP transparan 720 × 720 piksel, dengan skala tubuh dan garis kaki yang diselaraskan. Pose menunjuk memiliki ruang tambahan untuk lengan dan aksen.
- Sensor: ilustrasi produk berdasarkan **WhatsApp Video 2026-10-23 at 7.02.56 PM.mp4**, cuplikan sekitar detik 6. Bentuk kotak biru, layar vertikal, tulisan AERO SENSE, lubang pemasangan, dan ventilasi diagonal dipertahankan. Gaya ilustrasi 2.5D dengan gradasi biru muda dan cyan mengikuti maskot Falcon, tanpa tekstur plastik fotorealistis. Gambar dibuat dengan tool Imagegen bawaan, lalu dikonversi menjadi WebP transparan 900 × 900 piksel. Layar ilustrasi bukan pembacaan sensor aktual.
- Aset final berada di `public/assets/aerobot/falcon/` dan `public/assets/environment/sensor-node-v3.webp`. Nama baru mencegah penggunaan gambar lama dari cache.

## Penempatan

- Beranda: maskot tenang, memeriksa, atau waspada mengikuti status sensor; ilustrasi perangkat menggantikan kapsul lama.
- AERO-BOT: avatar berbicara saat siap dan memeriksa saat memproses; panel sumber memakai pose memeriksa.
- Masuk: pose tenang. Pendaftaran dan sapaan: pose menyapa. Dialog WhatsApp: pose tenang.
- Pose menunjuk dan antusias tersedia untuk penggunaan berikutnya; keduanya tidak diputar bergantian secara acak.
- Animasi mengambang yang sudah ada dipertahankan. Gambar berhenti bergerak saat di luar layar/tab tersembunyi dan mengikuti preferensi pengurangan gerakan.

## Prompt ilustrasi sensor

Latest style direction: match the Falcon mascot with soft vector-like 2.5D gradients, periwinkle/cobalt blue planes, cyan edge highlights, pale visor-like screen and clean simplified shading; no photographic texture. Hardware reference and details remain as follows. Create one isolated premium product visualization of the real AEROSENSE environmental sensor enclosure in the reference photograph for its dashboard website. Keep the vertically oriented royal cobalt blue rectangular 3D printed box, subtly rounded corners, four recessed mounting holes, small recessed portrait TFT screen in the upper third, engraved AERO above SENSE lettering, and diagonal lower ventilation slots. Clean up fabrication marks without retaining printed texture. Slight three-quarter front view with the right side visible. Studio lighting with cyan highlights. Entire device visible, centered, square composition, transparent background, no floor or external shadow. No wires, room, hand, clouds, leaves, robot, antenna, or invented hardware. Screen: abstract blue/cyan environmental interface, no measurement numbers. This is a visual illustration, not a measurement claim.

## Server

Verifikasi lokal: TypeScript dan build Vite produksi berhasil; lint berkas yang diubah dan detector desain tidak menemukan masalah. Pemeriksaan browser pada lebar 1440 dan 390 piksel menunjukkan aset termuat, tanpa overflow horizontal atau error JavaScript. Ketujuh pose terdekode; pilihan status waspada/bahaya menampilkan pose memeriksa/peringatan. Pengurangan gerakan menonaktifkan animasi sensor. Pengujian ini memakai data demo lokal, bukan pengujian API server.

Perubahan disiapkan secara lokal pada branch `feat/environment-insights`, basis commit `9196315`. Belum diterapkan ke server: host SSH dapat dijangkau, tetapi sesi otomatis ditolak dengan Permission denied (publickey,password). Preview lokal memakai mode demo terpisah; build produksi tetap memakai konfigurasi API produksi yang sudah ada.

Setelah perubahan sumber dan aset ini tersedia di checkout Ubuntu yang sesuai, jalankan dari direktori proyek:

```bash
docker compose up -d --build web
curl --fail http://127.0.0.1:8082/api/health
```

Periksa tampilan melalui domain setelah server dan Cloudflare Tunnel kembali aktif. Paket ini tidak mengubah firmware, API, database, maupun konfigurasi tunnel.

Pembaruan layout: karakter dibatasi dalam area ilustrasi tersendiri agar tidak menutupi teks atau tombol. Tujuh gelembung biru/cyan dan kurva aliran udara memperjelas latar. Diperiksa pada lebar 1440, 1100, dan 390 piksel: tidak ada overlap area teks dengan ilustrasi, tidak ada overflow horizontal, dan sensor v3 termuat.

Sensor background: an open cyan airflow orbit and five widely spaced bubbles, arranged around the perimeter like the supplied reference, kept behind the device. No overlapping ribbons, tiles, or enclosed rings. The mobile device illustration is slightly reduced to keep it separated from the metric cards. Decorative motion pauses offscreen and is disabled under reduced motion.

Sensor size/color correction: the desktop illustration stage is capped at 360 × 300 px; the image is absolutely contained and scaled to 86%, so intrinsic image dimensions cannot expand the grid row. Mobile keeps its 280 × 230 px stage at 90% image scale. Sensor illustration remains fully opaque and blue even when data is unavailable; freshness is still communicated through the status and missing values. Browser checks at 1920, 1440, and 390 px verified matching available/pending image filters and at least 23 px between the image box and metric cards.

Reference-matched sensor composition: a fixed 7-degree tilt, five varied cyan spheres and a short right-hand continuation of the airflow arc. Keep the existing gentle floating cycle, pause offscreen, and disable movement for reduced motion. Verified on desktop and mobile with clear separation from metric cards.

# Panel lingkungan dan animasi

Beranda menempatkan node AEROSENSE di atas informasi publik. Nilai lama tidak ditampilkan sebagai kondisi saat ini. Debu optik, eCO2 dan PM2.5 tervalidasi tetap dibedakan.

## Aset

Semua aset web berada di `public/assets/environment/`. Ada 11 ilustrasi WebP dengan latar transparan: sunny, cloudy, rain, storm, air, haze, soil, fire, flood, earthquake, dan sensor. Gambar perangkat adalah ilustrasi, bukan foto produk.

Ilustrasi dibuat menggunakan image generation bawaan, lalu diubah menjadi WebP maksimal 560 px. Tidak ada permintaan gambar atau model AI saat pengguna membuka halaman.

### Prompt dasar

One premium 3D environmental UI illustration, genuinely transparent background. Tactile pearl-white clay, glossy translucent ice-blue/cobalt/periwinkle, soft mint-green accents, rounded polished forms, realistic soft upper-left studio lighting, elevated three-quarter front view. Cohesive weather-app style with puffy sculptural clouds and glass raindrops. Single centered readable object group, 80 percent square. Actual 3D render not flat or line art. No text, numbers, branding, watermark, rectangle, ground plane or checkerboard.

Subjek per gambar:

| Aset | Subjek |
| --- | --- |
| sunny | A puffy white cloud and a warm golden sun |
| cloudy | Two overlapping pearl-white and lavender clouds, no sun or rain |
| rain | A puffy cloud with three glossy cyan raindrops |
| storm | A periwinkle storm cloud, golden lightning and cyan drops |
| air | Translucent blue airflow ribbons around a fresh green leaf |
| haze | A blue-grey skyline partially veiled in light-grey haze |
| soil | Rounded layered soil, a two-leaf seedling and a blue drop |
| fire | An orbital satellite and orange observation pin above a land tile, no flames |
| flood | A glossy river flowing between rounded stones and green banks |
| earthquake | Geological blocks separated by a fault, globe and seismic rings |
| sensor | A generic white air monitor, blank screen and blue airflow curls |

## Pemilihan gambar

Cuaca mengikuti kode WMO yang masih berlaku: 0 cerah, kode hujan untuk ilustrasi hujan, 95/96/99 untuk petir. Tanpa kode yang sesuai, gunakan awan netral. Suhu tinggi tidak otomatis dianggap cerah. Angka lama atau prakiraan masa depan tidak dipakai untuk ilustrasi kondisi sekarang.

Udara mengikuti kategori US AQI dari penyedia. Tanah, sungai, titik panas, dan gempa memiliki ilustrasi kategori sendiri. Gambar yang diredupkan berarti data belum tersedia. Ilustrasi bukan bukti kejadian.

Kadar air tanah `m³/m³` ditampilkan sebagai `% volume` dengan mengalikan nilai dengan 100. Nilai asli tetap tersedia di rincian, dan persentase ini bukan kelembapan udara.

## Animasi

`atmosphere.mp4` adalah loop dekoratif Remotion 8 detik, 960 × 540, 24 fps, sekitar 95 KB. Sumbernya berada di `motion/`. Web menggunakan elemen video native, tanpa Remotion Player atau dependensi video di bundle aplikasi.

Video mulai dimuat saat panel terlihat, berhenti saat panel keluar layar atau tab tersembunyi. Tombol jeda menghentikan video dan gerak ilustrasi panel. Pengaturan reduced motion menonaktifkan animasi dekoratif. Gerak ilustrasi menggunakan transform CSS, tanpa perubahan layout.

Ringkasan lingkungan dan sensor tetap memakai aturan lokal. Tidak ada tambahan pemakaian token Gemini untuk ilustrasi, animasi, atau ringkasan panel.

## Uji lokal

Jalankan `pnpm test`, `pnpm build` dan `pnpm lint`. `server/tests/preview.mjs` hanya menggunakan data contoh lokal, tidak menghubungi Supabase atau n8n produksi. Jangan memakai nilai dari pratinjau tersebut sebagai kondisi lapangan.

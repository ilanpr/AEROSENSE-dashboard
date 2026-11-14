# WATERSENSE — kontrol manual dari web

## Dua pemegang kendali

1. **Pemegang server dan n8n:** ikuti [Langkah 1](WATERSENSE-01-WEB-N8N.md). Pasang broker, migrasi database, deploy API/web, daftarkan perangkat, lalu import workflow.
2. **Pemegang ESP32:** ikuti [Langkah 2](WATERSENSE-02-FLASH-ESP32.md). Gunakan sketch baru `firmware/watersense-mqtt`, pertahankan sambungan yang sudah berhasil, isi Wi-Fi dan password perangkat secara privat, lalu flash dan uji bersama.

Konfigurasi tim: broker LAN **172.16.0.84:1883**, ID/username perangkat **mist-01**. Password dibuat di server; tidak ada password produksi di paket ini.

Alur: web → API berizin per lokasi → antrean → n8n → MQTT → ESP32 dalam box WATERSENSE → pompa terintegrasi → sprinkler. Balasan/status kembali melalui n8n ke web. LoRa sensor tetap terpisah.

## Bukti pemeriksaan lokal

- Web: TypeScript dan build produksi berhasil; lint tanpa error, delapan peringatan pada file lama.
- API: enam pengujian kontrol aktuator berhasil. Migrasi dan transaksi antrean diuji di PostgreSQL lokal PGlite; izin lokasi, durasi, idempotensi, stop, urutan ACK, dan heartbeat diperiksa.
- Firmware: kompilasi ESP32-S3 core 3.3.12 berhasil, 951641 byte program dan 48848 byte RAM global. Uji logika C++ berhasil. Konfigurasi contoh disediakan; board fisik tetap perlu dicocokkan.
- UI: diperiksa pada desktop dan ponsel 390 px, termasuk konfirmasi, antrean, dan stop di mode demo lokal. Mode demo tidak mengirim ke perangkat.
- Seluruh suite backend: 67 dari 70 lulus. Tiga kegagalan yang sama juga direproduksi pada HEAD sebelum perubahan ini: dua pengujian demo (label/teks) dan satu ekspektasi akses auditor ESG. Tidak diubah dalam pekerjaan sprinkler.

## Batas verifikasi

Broker dan workflow produksi belum dijalankan dari lingkungan pengerjaan; koneksi SSH terpisah ditolak autentikasi meskipun terminal SSH pengguna aktif. Migrasi produksi, koneksi ESP32, flashing, keluaran GPIO, dan debit air belum diuji fisik. Jangan menganggap gambar/status demo sebagai bukti alat bekerja.

Batas awal commissioning: 1–10 detik; jeda minimum 10 menit. Siklus tes otomatis 15 detik dihapus. Perangkat baru terdaftar dalam keadaan disabled hingga kedua pemegang kendali siap.

## Referensi implementasi

- MQTT n8n: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.mqtt/
- MQTT trigger: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.mqtttrigger/
- PubSubClient: https://pubsubclient.knolleary.net/api

Perintah n8n memakai QoS 1 dan retain false. Publikasi ACK PubSubClient adalah QoS 0 dengan snapshot retained dan pemulihan saat reconnect; ini bukan jaminan pengiriman ACK persis sekali. Web menampilkan status kedaluwarsa bila konfirmasi tidak diterima.

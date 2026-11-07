# Langkah 2 — Pemegang perangkat dan flashing ESP32

Kerjakan setelah pemegang server memberikan IP LAN broker dan password khusus **mist-01** secara privat. Tidak perlu mengubah firmware node sensor LoRa.

## Dasar perangkat yang dipertahankan

Kode mengikuti **WATERSENSE_tes.ino** yang telah berhasil pada alat tim:

| Fungsi | Konfigurasi |
|---|---|
| MOSFET pompa | GPIO 4, aktif HIGH |
| Pembacaan baterai | GPIO 1, `analogReadMilliVolts`, rata-rata 16 sampel |
| Tombol lokal | GPIO 21 ke GND, `INPUT_PULLUP` |
| Rasio sensor tegangan | 5,0 |
| Berhenti baterai lemah | di bawah 9,9 V |
| Boleh jalan kembali | di atas 10,8 V |
| Pompa | sudah berada di dalam box WATERSENSE |

Firmware baru: **firmware/watersense-mqtt/**. Simpan sketch tes asli sebagai backup; file asli di Downloads tidak diubah.

Perubahan terhadap sketch tes:

- Siklus otomatis nyala/mati setiap 15 detik dihapus. Alat tidak menyemprot sendiri setelah boot.
- GPIO 4 tetap LOW saat boot. Perintah web hanya diterima lewat topic akun perangkat sendiri.
- Tombol lokal menjadi tekan-sekali: mulai maksimal 10 detik; tekan lagi saat berjalan untuk berhenti. Menahan tombol tidak memperpanjang timer.
- Pengaman baterai tetap ada; pembacaan baterai yang hilang/tidak masuk akal tidak mengizinkan pompa.
- Timer ESP32 independen mematikan GPIO meskipun pemrosesan jaringan tertahan. Perintah ganda tidak memulai ulang timer.
- Stop remote diterima meskipun sedang cooldown/baterai lemah; perintah pulse lama yang mendahului stop ditolak.
- Wi-Fi/MQTT putus menghentikan pulse remote. Tombol fisik masih bisa digunakan secara lokal dengan pengaman baterai dan durasi.

## 1. Sambungkan ESP32 untuk pemrograman

1. Matikan catu pompa selama proses upload dan pemeriksaan awal. Gunakan USB untuk pemrograman.
2. Di Arduino IDE pilih board yang sesuai perangkat. Kode telah ditargetkan untuk pengujian kompilasi **ESP32-S3 Dev Module**; pastikan tulisan pada modul memang ESP32-S3.
3. Pilih port USB perangkat yang benar.
4. Gunakan ESP32 core 3.x. Pasang **PubSubClient 2.8** dan **ArduinoJson 7** melalui Library Manager.
5. Buka `firmware/watersense-mqtt/watersense-mqtt.ino`. Semua file pada folder itu harus tetap bersama.

## 2. Isi konfigurasi

Salin `config.example.h` menjadi `config.h` di folder sketch. Isikan hanya di komputer pemegang alat:

```cpp
#define ACTUATOR_ID "mist-01"
#define WIFI_SSID "NAMA_WIFI_2G4"
#define WIFI_PASSWORD "PASSWORD_WIFI"
#define MQTT_HOST "172.16.0.84"
#define MQTT_PORT 1883
#define MQTT_PASSWORD "PASSWORD_KHUSUS_MIST_01"
```

ESP32 memakai Wi-Fi 2,4 GHz yang dapat mencapai IP broker. Tidak memakai Cloudflare Tunnel atau IP localhost laptop. Username MQTT otomatis mengikuti `ACTUATOR_ID`. Jangan memakai akun broker milik n8n.

Pin dan ambang baterai sudah mengikuti sketch tim. Jangan mengubahnya menjadi pin contoh ESP32 lain. File `config.h` diabaikan Git; jangan membagikannya dalam ZIP maupun tangkapan layar. Bila ada float switch, konfigurasi `WATER_OK_PIN` dan levelnya setelah pemasangan benar; default `-1` berarti tidak ada sensor air, sehingga ketersediaan air harus diperiksa operator.

## 3. Compile dan upload

Tekan Verify, lalu Upload. Bila board meminta boot mode, gunakan prosedur BOOT/RESET board yang dipakai. Buka Serial Monitor **115200**. Keluaran yang dicari:

```text
WATERSENSE siap. Pompa OFF; siklus tes otomatis dinonaktifkan.
WATERSENSE MQTT terhubung
```

Jam harus tersinkron NTP sebelum pulse remote diterima. Pastikan jaringan mengizinkan layanan waktu. Saat baterai belum terpasang, perangkat tidak siap menyalakan pompa; ini sesuai pengaman, bukan kegagalan koneksi MQTT.

## 4. Uji pin dan alat bersama pemegang web

1. Dengan pompa belum diberi catu, pastikan GPIO 4 tidak aktif setelah boot/restart.
2. Hubungkan pembacaan baterai dan verifikasi tegangan dengan alat ukur tim. Pastikan rasio 5,0 sesuai modul pembagi yang benar-benar terpasang.
3. Isi air dan atur arah nozzle agar tidak menyemprot elektronik/inlet sensor. Hubungkan catu pompa melalui rangkaian MOSFET yang sudah terbukti bekerja.
4. Minta operator web menjalankan 3 detik. Cocokkan output fisik dan status controller. Output harus mati tanpa menunggu pesan OFF dari server.
5. Coba tombol lokal: satu tekanan memulai pulse; tekanan kedua menghentikan. Menahan tombol tidak boleh mengulang siklus.
6. Coba stop web selama berjalan dan hilangnya Wi-Fi saat pulse remote. Uji harus menghasilkan output mati.
7. Uji reboot dan pesan duplikat tanpa mengulang penyemprotan yang sama.

Jeda awal 10 menit juga berlaku di perangkat. Jangan menghapus deduplikasi/TTL/cooldown hanya agar uji bisa dipencet berulang. Untuk pengujian cepat, lakukan simulasi/indikator atau jadwalkan uji terkontrol bersama pengembang; setelan lapangan ditentukan setelah commissioning.

## Berikan hasil ke pemegang n8n

Sampaikan ID perangkat, apakah MQTT terhubung, tegangan yang diperiksa, hasil pulse 3 detik, hasil stop, serta hasil uji restart/putus koneksi. Jangan mengirim password Wi-Fi atau MQTT. MQTT ACK mengonfirmasi pemrosesan dan status keluaran; pengukuran debit air memerlukan sensor tambahan.

## Konfigurasi instalasi tim

Alamat LAN server yang dikirim tim: **172.16.0.84/22** pada `ens18`. Host MQTT ESP32: **172.16.0.84**, port **1883**; ID dan username perangkat: **mist-01**. Alamat ini belum membuktikan akses dari Wi-Fi ESP32; uji koneksi setelah broker dipasang dan reservasi IP pada router. n8n tetap memakai host Docker **aerosense-mqtt**.

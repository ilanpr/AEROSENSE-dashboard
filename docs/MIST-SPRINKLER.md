# ESP32 mist sprinkler dengan MQTT

## Jalur komunikasi

Node sensor → LoRa → gateway yang sudah ada → Supabase → n8n → broker MQTT → Wi-Fi → ESP32 sprinkler → relay/MOSFET → pompa atau katup.

MQTT actuator memakai Wi-Fi; tidak menambah paket pada jaringan LoRa sensor. Jangkauan Wi-Fi harus diuji pada posisi sprinkler. Jika Wi-Fi belum tersedia, siapkan access point atau koneksi gateway; jangan menganggap jarak dekat sensor otomatis berarti ada Wi-Fi.

## Pasangan perangkat

Workflow **AEROSENSE | Mist sprinkler MQTT** disimpan sebagai draft di https://flow.aerosense.me/workflow/ZrSWBmM6ITgtdBEF. Uji baca data dan keputusan di n8n berhasil dalam 2,82 detik pada 21 Oktober 2026; keluaran `publish:false`, `dry_run:true`, `reason:rule_not_ready` karena aturan debu produksi belum lengkap. Tidak ada perintah MQTT atau penyalaan pompa pada uji tersebut. Credential broker dan firmware ESP32 belum dipasang. JSON impor tersedia di `n8n/mist-sprinkler.workflow.json`. Node **Pasangan node dan sprinkler** mengembalikan daftar pasangan. Hanya node yang benar-benar memiliki sprinkler dimasukkan. Satu node dapat dipasangkan ke beberapa sprinkler dengan actuator_id berbeda. Jangan memakai actuator_id yang sama untuk dua pasangan dalam draft ini; bila satu sprinkler melayani banyak node, tentukan agregasi zona terlebih dahulu.

Pasangan contoh `node-01 → mist-01` masih `enabled:false` dan `dry_run:true`; ganti berdasarkan lokasi yang disetujui pengelola. Data pemicu dibaca dari tabel ae_readings dan ambang ae_rules, bukan dari jawaban Gemini atau status API wilayah.

## Cara kerja draft

1. Poll tiap menit atau jalankan manual.
2. Baca sepuluh pembacaan terakhir dan aturan metrik yang dipasangkan.
3. Tiga pembacaan terbaru harus unik, berurutan, valid, dan berumur paling lama dua menit. Sesuaikan umur data setelah interval telemetry nyata diketahui.
4. Jika ketiganya melewati `danger_high`, status Bahaya; jika ketiganya melewati `high`, status Waspada. Di bawah `clear_below` adalah pulih. Pembacaan yang belum konsisten ditahan.
5. Default durasi uji: Waspada tiga detik, Bahaya lima detik, cooldown sepuluh menit. Batas kode sepuluh detik. Ini parameter uji kendali, bukan rekomendasi efektivitas mist lapangan.
6. Saat enabled=false atau dry_run=true, keluaran ditampilkan tanpa memanggil MQTT. Jika aktif, publish QoS 1 dan retain=false.
7. Static data menyimpan waktu publish dan reading_id terakhir per actuator pada eksekusi production yang sukses. Pada eksekusi manual state ini tidak dapat diandalkan. Pengaman perangkat tetap wajib untuk restart, overlap eksekusi, dan duplikasi pesan.

Metrik yang didukung: debu optik `dust_ug_m3` atau `pm25_ug_m3` hanya jika node menandai PM2.5 tervalidasi. eCO2, gas, suhu, prediksi GRU, dan kabar bencana tidak otomatis menjadi pemicu air. Ambang harus berasal dari konfigurasi pengelola dan validasi lapangan; debu optik tidak otomatis setara PM2.5 atau AQI. Pengelola harus menilai kesesuaian penyemprotan di zona tersebut.

## Kontrak ESP32

Subscribe `aerosense/actuators/mist-01/command`, ganti mist-01 dengan ID perangkat. Broker harus memakai autentikasi dan ACL per topik; jangan memakai broker publik anonim untuk aktuator.

Payload pulse berisi `command_id`, `actuator_id`, `node_id`, `reading_id`, `status`, `duration_ms`, `cooldown_ms`, `issued_at` dan `expires_at`. TTL perintah tiga puluh detik. ESP32 harus:

- Mematikan output saat boot/reboot dan sebelum koneksi jaringan dibuat.
- Menolak ID yang tidak cocok, timestamp tidak valid, jam belum sinkron, perintah kedaluwarsa, atau command_id duplikat. Ingat ID dan cooldown lintas reboot; jangan memulai pulse baru hanya karena reconnect.
- Memakai timer lokal nonblocking untuk OFF, maksimum sepuluh detik, tanpa menunggu pesan OFF dari n8n.
- Memiliki cooldown lokal minimum yang tidak bisa diperpendek oleh payload; nilai uji sepuluh menit. Saat pulse aktif, duplikasi pesan tidak memperpanjang timer.
- Memprioritaskan sakelar OFF/manual dan interlock air kosong. Ketika broker putus, matikan output.
- Mengirim ACK dengan command_id dan keadaan nyata seperti accepted, rejected, completed, atau fault. Publish MQTT berhasil belum membuktikan pompa bekerja; verifikasi debit/arus bila dibutuhkan. Draft ini belum berlangganan atau menyimpan ACK.

## Pemasangan dan uji

GPIO ESP32 mengendalikan driver relay/MOSFET yang cocok dengan beban; pompa tidak diberi daya langsung dari GPIO. Jenis driver, tegangan, arus, default level aktif, dan proteksi beban harus disesuaikan dengan pompa/katup sebenarnya. Pasang sprinkler agar semprotan tidak mengenai inlet sensor atau elektronik.

1. Pilih credential Postgres yang benar pada node baca sensor dan credential MQTT pada node publish.
2. Tetapkan pasangan node/sprinkler serta aturan debu bersama pengelola.
3. Uji output dry-run dan data lama/invalid terlebih dahulu.
4. Pasang firmware ESP32 yang mematuhi kontrak, lalu uji memakai LED atau relay dengan pompa terlepas.
5. Uji perintah duplikat, kedaluwarsa, restart, air kosong dan koneksi putus.
6. Setelah uji fisik selesai, ubah dry_run=false dan enabled=true hanya pada pasangan yang siap, lalu publish workflow.

Jangan mengaktifkan workflow untuk pompa nyata hanya karena tes JavaScript lulus. Pemilihan lokasi, pola semprotan, dan efektivitas terhadap debu memerlukan evaluasi lapangan.

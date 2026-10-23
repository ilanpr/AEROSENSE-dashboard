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

## Setup konektivitas MQTT

### 1. Broker di server Ubuntu

Broker Mosquitto berjalan sebagai container `aerosense-mqtt` pada network `n8n_default`, sehingga n8n memanggilnya dengan nama container. ESP32 masuk lewat port 1883 di IP LAN server. Login anonim ditolak; ACL membuat setiap sprinkler hanya bisa membaca perintahnya sendiri.

```bash
cd ~/AEROSENSE-dashboard
git pull --ff-only origin feat/environment-insights
bash server/scripts/setup-mqtt.sh mist-01
```

Tambahkan ID lain dipisah spasi (`mist-01 mist-02`). ID memakai huruf kecil, angka, dan tanda `-`, sama persis dengan `actuator_id` di n8n. Password baru dicetak sekali dan disimpan di `~/aerosense-mqtt/credentials.env` (mode 600). Menjalankan ulang script tidak mengganti password lama.

Batasi port 1883 hanya untuk jaringan perangkat, misalnya `sudo ufw allow from 192.168.1.0/24 to any port 1883 proto tcp`. Port ini tanpa TLS; jangan dibuka ke internet. Jika sprinkler berada di jaringan lain, pakai VPN atau listener TLS 8883 terlebih dahulu.

Uji dari server:

```bash
source ~/aerosense-mqtt/credentials.env
docker exec aerosense-mqtt mosquitto_sub -u n8n-aerosense -P "$MQTT_PASSWORD_N8N_AEROSENSE" -t 'aerosense/actuators/+/#' -v
```

Biarkan terminal ini terbuka untuk melihat status dan ACK ESP32.

### 2. Credential di n8n

Buat credential **MQTT**: Protocol `mqtt`, Host `aerosense-mqtt`, Port `1883`, Username `n8n-aerosense`, Password dari `MQTT_PASSWORD_N8N_AEROSENSE`, SSL mati. Pilih credential ini pada node **MQTT perintah sprinkler**.

### 3. Firmware ESP32

Kode ada di `firmware/mist-sprinkler/`. Di Arduino IDE pasang board ESP32 (core 3.x) serta library **PubSubClient** 2.8 dan **ArduinoJson** 7. Salin `config.example.h` menjadi `config.h`, lalu isi Wi-Fi, IP LAN server, password `mist-01`, pin relay, dan level aktif relay. Upload, lalu buka Serial Monitor 115200 sampai muncul `MQTT terhubung`. Terminal `mosquitto_sub` menampilkan status `online` dengan `output:"off"`.

Firmware menerapkan kontrak di atas: output mati saat boot, TTL dan jam NTP diperiksa, command_id dan cooldown disimpan di NVS sehingga tetap berlaku setelah reboot, timer OFF lokal maksimal 10 detik, sakelar OFF dan sensor air memotong output, putus Wi-Fi/broker mematikan output, dan setiap perintah dijawab ACK `accepted`, `rejected` (dengan alasan), `completed`, atau `fault`. Status `offline` dikirim broker lewat Last Will saat ESP32 hilang. Logika validasi dapat diuji tanpa perangkat; uji simulasi 22 skenario lulus pada 23 Oktober 2026.

### 4. Uji perintah dengan LED, pompa dilepas

```bash
source ~/aerosense-mqtt/credentials.env
now=$(date -u +%Y-%m-%dT%H:%M:%SZ); exp=$(date -u -d '+30 seconds' +%Y-%m-%dT%H:%M:%SZ)
docker exec aerosense-mqtt mosquitto_pub -u n8n-aerosense -P "$MQTT_PASSWORD_N8N_AEROSENSE" -q 1 -t aerosense/actuators/mist-01/command \
  -m "{\"version\":1,\"command_id\":\"test-$(date +%s)\",\"actuator_id\":\"mist-01\",\"node_id\":\"node-01\",\"reading_id\":\"manual-test\",\"metric\":\"dust_ug_m3\",\"status\":\"warning\",\"action\":\"pulse\",\"duration_ms\":3000,\"cooldown_ms\":600000,\"issued_at\":\"$now\",\"expires_at\":\"$exp\"}"
```

LED menyala 3 detik lalu mati sendiri, dan terminal `mosquitto_sub` menampilkan ACK `accepted` lalu `completed`. Perintah kedua dalam 10 menit dijawab `rejected` dengan alasan `cooldown`; itu tanda pengaman bekerja.

## Pemasangan dan uji

GPIO ESP32 mengendalikan driver relay/MOSFET yang cocok dengan beban; pompa tidak diberi daya langsung dari GPIO. Jenis driver, tegangan, arus, default level aktif, dan proteksi beban harus disesuaikan dengan pompa/katup sebenarnya. Pasang sprinkler agar semprotan tidak mengenai inlet sensor atau elektronik.

1. Pilih credential Postgres yang benar pada node baca sensor dan credential MQTT pada node publish.
2. Tetapkan pasangan node/sprinkler serta aturan debu bersama pengelola.
3. Uji output dry-run dan data lama/invalid terlebih dahulu.
4. Pasang firmware ESP32 yang mematuhi kontrak, lalu uji memakai LED atau relay dengan pompa terlepas.
5. Uji perintah duplikat, kedaluwarsa, restart, air kosong dan koneksi putus.
6. Setelah uji fisik selesai, ubah dry_run=false dan enabled=true hanya pada pasangan yang siap, lalu publish workflow.

Jangan mengaktifkan workflow untuk pompa nyata hanya karena tes JavaScript lulus. Pemilihan lokasi, pola semprotan, dan efektivitas terhadap debu memerlukan evaluasi lapangan.

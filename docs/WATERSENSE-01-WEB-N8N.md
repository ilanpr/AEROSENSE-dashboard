# Langkah 1 — Pemegang web, server, Supabase, dan n8n

Tujuan: admin atau kader yang ditugaskan sebagai pengelola lokasi dapat mengaktifkan WATERSENSE melalui **Kelola kawasan → Kendali sprinkler**. Pompa berada di dalam box WATERSENSE bersama ESP32. Tombol web mengirim perintah, kemudian web menunggu konfirmasi pengendali.

## Alur yang digunakan

Web → API login/izin lokasi → antrean perintah → n8n → MQTT melalui Wi-Fi → WATERSENSE → pompa terintegrasi → sprinkler. ESP32 mengirim ACK dan status melalui MQTT → n8n → API → web.

Jalur sensor tetap node sensor → LoRa → gateway → sistem pemantauan. MQTT tidak ditumpangkan ke LoRa. Tetap lakukan uji radio dan catu daya pada instalasi; pemisahan jalur ini tidak merupakan klaim bebas interferensi seluruh perangkat.

## 1. Siapkan broker pada Ubuntu yang menjalankan n8n

Jalankan **di terminal SSH Ubuntu**, dari checkout yang sudah berisi revisi ini:

```bash
cd ~/AEROSENSE-dashboard
bash server/scripts/setup-watersense.sh mist-01
```

Script memakai ID awal **mist-01**, membuat broker Mosquitto berautentikasi di network Docker `n8n_default`, dan menampilkan IP LAN yang harus dipakai ESP32. Port broker dibind ke IP LAN yang dipilih, bukan domain Cloudflare. Reservasi IP tersebut pada DHCP router.

Jika server mempunyai beberapa antarmuka, tentukan alamat LAN yang satu jaringan/routable dengan Wi-Fi ESP32:

```bash
MQTT_LAN_IP=GANTI_IP_LAN_SERVER bash server/scripts/setup-watersense.sh mist-01
```

Jangan mengisi `127.0.0.1`, `aerosense.me`, atau alamat NetBird sebagai host ESP32. Ketiganya bukan pengganti IP LAN broker bagi ESP32 yang tersambung ke Wi-Fi biasa. n8n memakai nama Docker **aerosense-mqtt**, port **1883**.

Password disimpan hanya di `~/aerosense-mqtt/credentials.env` dengan akses terbatas. Pemegang server membukanya di terminal tepercaya untuk mengisi credential n8n dan menyerahkan password akun `mist-01` secara privat kepada pemegang ESP32. Jangan menaruh password dalam JSON workflow, Git, tangkapan layar, atau chat.

Port 1883 pada paket ini untuk jaringan perangkat lokal. Jangan port-forward broker ke internet. Untuk lokasi berbeda jaringan, siapkan rute privat/VPN atau MQTT TLS sebelum commissioning. Tinjau aturan firewall host dan router sesuai subnet perangkat; jangan menonaktifkan NetBird.

Untuk sprinkler berikutnya, gunakan `mist-02` dan seterusnya. Jangan berbagi akun satu perangkat untuk beberapa controller.

## 2. Terapkan migrasi database

Buka Supabase SQL Editor dan jalankan **server/supabase/012_manual_sprinkler.sql** setelah migrasi yang sudah ada. Migrasi menambah tabel aktuator, antrean perintah, dan fungsi atomik. Tidak ada sprinkler yang otomatis diaktifkan.

Lihat lokasi yang benar sebelum mendaftarkan perangkat:

```sql
select id, name, location_id from public.ae_nodes order by name;
```

Pilih satu sensor acuan di area yang dilayani, lalu ganti nilai contoh berikut:

```sql
insert into public.ae_actuators (id,node_id,name,enabled)
values ('mist-01','GANTI_ID_SENSOR_ACUAN','WATERSENSE · Area Utara',false)
on conflict (id) do update set node_id=excluded.node_id,name=excluded.name;
```

Satu controller dapat melayani area yang sama dengan beberapa sensor; `node_id` di sini adalah acuan lokasi/hak akses, bukan koneksi radio langsung. Beberapa controller boleh memakai sensor acuan yang sama. Tidak semua sensor perlu mempunyai controller.

Keanggotaan yang sudah ada tetap digunakan: **admin/operator** dapat mengontrol pada lokasi penugasan; **viewer/auditor** hanya melihat. Akun kader memakai peran penyimpanan `operator`. Penugasan dilakukan admin, bukan melalui pendaftaran mandiri:

```sql
insert into public.ae_members(user_id,location_id,role)
values ('GANTI_UUID_AKUN','GANTI_ID_LOKASI','operator')
on conflict(user_id,location_id) do update set role=excluded.role;
```

## 3. Perbarui backend dan web

Paket revisi mengubah keduanya. Gunakan proses deploy checkout yang sudah berlaku; untuk instalasi pada direktori tim:

```bash
cd ~/AEROSENSE-dashboard
REVISION=$(git rev-parse HEAD)
bash server/scripts/deploy-update.sh "$REVISION"
docker compose up -d --build web
curl --fail http://127.0.0.1:8082/api/health
```

Perintah tersebut mengasumsikan checkout berisi seluruh perubahan paket ini dan telah dicommit. Jika memakai ZIP/patch, terapkan perubahan dan commit dahulu atau gunakan proses staging/deployment tim. Jangan `git pull` dari revisi lama lalu mengira fitur ini sudah ikut. Script deploy menjaga `.env` pada instalasi API `~/aerosense-api`; jangan menyalin konfigurasi rahasia ke frontend.

API baru:

- `GET /v1/actuators?node_id=...`: daftar dan status sesuai izin lokasi.
- `POST /v1/actuators/commands`: `actuator_id`, `request_id` UUID, `action: pulse|stop`, dan `duration_ms`.
- `/internal/actuators/claim`, `/published`, `/event`: khusus n8n, memakai header internal yang sudah digunakan backend.

Browser tidak terhubung langsung ke broker dan tidak menyimpan password MQTT.

## 4. Import workflow manual dan ACK

Import **n8n/mist-manual-control.workflow.json**. Nama: **AEROSENSE | WATERSENSE kontrol web dan ACK**.

Atur credential:

| Bagian | Pengaturan |
|---|---|
| Semua node HTTP | Generic Credential Type → Header Auth. Nama header `x-aerosense-internal-key`; nilainya `INTERNAL_API_KEY` backend yang sudah ada. |
| Kirim perintah MQTT | MQTT host `aerosense-mqtt`, port `1883`, username `n8n-aerosense`, password akun n8n dari file server. |
| Terima status dan konfirmasi ESP32 | Credential MQTT yang sama dengan **Client ID dikosongkan** agar n8n membuat ID unik tiap koneksi. Jika memakai Client ID tetap, gunakan dua credential dengan ID berbeda untuk publisher dan subscriber; jangan memakai ID perangkat. |

URL HTTP internal default `http://aerosense-api:8080`. Sesuaikan hanya bila alias container API tim berbeda. Jangan menggantinya dengan URL frontend.

Cabang pengiriman: setiap 5 detik → claim antrean → pisahkan perintah → MQTT QoS 1, **retain false** → catat publish. Cabang penerimaan: topic ACK/status → simpan status ke API. `command_id` sama dengan ID antrean sehingga duplikasi tidak menambah satu siklus semprot.

Workflow otomatis lama **AEROSENSE | Mist sprinkler MQTT** tetap tersedia dan **jangan diaktifkan selama commissioning manual**. Ia memakai pembacaan/ambang sebagai pemicu; tombol manual memakai izin pengelola dan kesiapan aktuator. Perubahan ini tidak menyambungkan Gemini ke kendali pompa. Jika kelak menggabungkan otomatis dan manual, keduanya harus memakai antrean dan arbitrasi zona yang sama; jangan sekadar menyalakan dua publisher independen.

## 5. Uji bersama pemegang ESP32

1. Selesaikan Langkah 2 (firmware). Aktifkan workflow manual/ACK setelah credential benar. Aktivasi tidak menciptakan perintah; ia meneruskan antrean yang dikirim dari web.
2. Pastikan status `mist-01` menjadi Terhubung, baterai memadai, jam tersinkron, output mati. Heartbeat lama tidak dianggap online kembali.
3. Setelah perangkat siap dan area semprot aman, admin mengaktifkan perangkat terdaftar:

```sql
update public.ae_actuators set enabled=true where id='mist-01';
```

4. Masuk sebagai pengelola lokasi → Kelola kawasan → pilih sensor acuan → pilih 3 detik → Aktifkan sprinkler → konfirmasi.
5. Cocokkan status antrean → terkirim → perintah berjalan → selesai dengan Serial Monitor ESP32 dan kondisi alat. Publish MQTT saja belum membuktikan keluaran ESP32 aktif, dan keluaran aktif belum mengukur debit air.
6. Coba Hentikan saat berjalan. Perangkat mematikan output dan mengirim konfirmasi. Stop web memerlukan koneksi; tombol lokal dan batas waktu perangkat tetap tersedia.
7. Coba akun warga/auditor dan pengelola lokasi lain: tidak boleh menjalankan aktuator ini.
8. Cabut Wi-Fi saat perintah remote berjalan: output harus mati. Ulangi pesan yang sama: timer tidak boleh mulai ulang. Uji baterai lemah, restart, dan tombol lokal.

Batas awal: 1–10 detik per perintah; jeda minimum perangkat 10 menit. Ini setelan commissioning yang dapat ditinjau tim setelah uji alat, bukan rekomendasi durasi penanganan polusi. Stop melewati jeda dan status disabled, tetapi tetap membutuhkan izin lokasi.

## Penyimpanan dan status

Status perangkat hanya satu snapshot per controller, bukan log heartbeat. Perintah sukses disimpan 2 hari; gagal/timeout 7 hari, dibersihkan saat dispatcher berjalan. Tidak ada audio atau payload sensor baru yang digandakan untuk kontrol ini. n8n tidak menyimpan hasil eksekusi sukses workflow ini; aktifkan pruning eksekusi gagal mengikuti kebijakan n8n tim.

## Status handoff

Kode, JSON impor, dan pengujian lokal disediakan. Broker, migrasi, workflow produksi, web live, dan flashing fisik belum diklaim aktif sampai tim menjalankan langkah di atas. SSH dari lingkungan pengerjaan ditolak autentikasinya; IP LAN broker harus dibaca dari server saat setup.

## Konfigurasi instalasi tim

Alamat LAN server yang dikirim tim: **172.16.0.84/22** pada `ens18`. Host MQTT ESP32: **172.16.0.84**, port **1883**; ID dan username perangkat: **mist-01**. Alamat ini belum membuktikan akses dari Wi-Fi ESP32; uji koneksi setelah broker dipasang dan reservasi IP pada router. n8n tetap memakai host Docker **aerosense-mqtt**.

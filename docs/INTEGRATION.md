# Integrasi web, backend, Supabase, dan n8n

## Permintaan chat

1. Pengguna login melalui Supabase Auth. Browser mendapatkan sesi pengguna.
2. Web mengirim `POST /api/v1/chat` dengan Bearer token, teks, serta node opsional. Satu pengiriman memiliki Idempotency-Key.
3. Backend memverifikasi token ke Supabase dan memeriksa keanggotaan lokasi jika ada node yang dipilih.
4. Backend menyimpan `ae_jobs`: kind `web_chat`, owner_id, dedupe_key, body.text, dan body.node_ids. Tanpa pilihan node, node_ids kosong.
5. Trigger database mengirim notifikasi pada channel `aerosense_events`. Control Center n8n memilih worker berdasarkan kind.
6. Worker mengambil lease job, memuat konteks sensor dan cache lingkungan, lalu meminta satu jawaban serta keputusan topik dari Gemini.
7. Endpoint internal menyimpan hasil melalui lease yang masih valid. `ae_jobs.result.text` berisi jawaban.
8. Web memeriksa `GET /api/v1/jobs?id=...` setiap 2 detik, maksimal 2 menit per percobaan. Jika belum selesai, tombol Cek jawaban melanjutkan pemeriksaan job yang sama.

Database menyimpan job sebelum n8n mulai. Jika n8n berhenti, permintaan tetap tersimpan; Control Center perlu pemulihan berkala untuk job yang belum diproses. Kecepatan paralel bergantung pada batas concurrency instance n8n dan API penyedia.

## Kontrak worker yang sudah ada

Gunakan workflow pada instance `flow.aerosense.me`.

| Workflow                | Fungsi                                                       |
| ----------------------- | ------------------------------------------------------------ |
| AERO-BOT Control Center | Mendengarkan event database dan memanggil worker sesuai kind |
| Jawaban website         | Memproses web_chat dan menyimpan result.text                 |
| AERO-BOT                | Memproses robot_chat, transkrip, jawaban dan perintah audio  |
| Data udara              | Mengevaluasi telemetry terhadap aturan                       |
| WhatsApp                | Menerima pesan, memproses pertanyaan dan mengirim notifikasi |
| Hub lingkungan          | Mengambil API publik dan memperbarui cache wilayah           |

Konfigurasi worker: `api_base_url=http://aerosense-api:8080`. Hub membaca semua area node aktif; worker chat hanya membaca cache node yang tercantum di `node_ids` job. Endpoint backend internal memakai credential dengan header `X-Aerosense-Internal-Key`. URL ini tidak dipanggil langsung oleh browser.

Nama dan ID workflow yang sudah terpasang perlu dipertahankan. Jangan mengganti credential n8n dengan publishable key Supabase atau memasukkan service-role key ke frontend. Implementasi ini memakai kontrak worker yang tersedia; tidak membuat workflow paralel baru.

## Data dan tabel

| Tabel                     | Ditulis oleh              | Dibaca untuk                                                           |
| ------------------------- | ------------------------- | ---------------------------------------------------------------------- |
| ae_nodes                  | Pengelola perangkat       | Nama, gateway, lokasi asli dan status validasi node                    |
| ae_members                | Pengelola akses           | Membatasi node per akun dan peran                                      |
| ae_readings               | Ingest gateway            | Historis metrics, raw_metrics, raw_payload, processing, waktu, dan GRU |
| ae_latest                 | Fungsi ingest             | Snapshot terbaru tanpa menyalin historis ke browser                    |
| ae_sensor_context         | View ae_nodes + ae_latest | Konteks sensor terbaru untuk web dan n8n                               |
| ae_model_runs             | Fungsi ingest             | Log pemrosesan dan versi model untuk kajian                            |
| ae_jobs                   | API, database dan n8n     | Permintaan, lease, retry, serta hasil chat                             |
| ae_rules                  | Operator melalui API      | Ambang atas, batas pulih, jeda peringatan                              |
| ae_alerts                 | Worker telemetry          | Peringatan dan status peninjauan                                       |
| ae_contacts               | Alur WhatsApp             | Kontak dan jendela pesan                                               |
| ae_subscriptions          | Pairing dan WhatsApp      | Langganan per nomor dan node                                           |
| ae_pair_codes             | API dan pairing           | Kode penghubung sekali pakai dengan batas 10 menit                     |
| ae_robots                 | Pengelola dan API         | Node robot, mode senyap dan cooldown kehadiran                         |
| ae_commands               | Worker dan API            | Perintah mendengarkan, berbicara, serta status penyelesaiannya         |
| ae_environment_areas      | Hub lingkungan/pengelola  | Titik node yang dipilih; koordinat disalin otomatis dari `ae_nodes`    |
| ae_environment_area_cache | n8n Hub lingkungan        | Fakta publik per area dan penyedia, waktu, serta kegagalan pembaruan   |
| ae_training_sets          | Snapshot training         | Metadata satu versi dataset                                            |
| ae_training_examples      | Snapshot training         | Pasangan input dan target aktual untuk dataset tersebut                |

Web tidak menulis langsung ke tabel menggunakan service-role. Backend melakukan pemeriksaan akses sebelum membaca atau menulis data privat. Pendaftaran akun tidak otomatis memberikan keanggotaan lokasi.

## API browser

Semua URL di bawah menggunakan prefix `/api` pada nginx/Vite. Server API sendiri menerima path tanpa prefix.

| Method dan path                  | Masuk                                                               | Keluar                                                     |
| -------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| GET /v1/config                   | Tidak perlu login                                                   | URL Supabase, publishable key dan robot default             |
| GET /v1/environment?node_id=...  | Sesi dan keanggotaan node                                           | Area node, provider, fakta, timestamp dan stale              |
| GET /v1/dashboard                | Sesi pengguna                                                       | Node yang diizinkan, role dan snapshot terbaru             |
| GET /v1/nodes                    | Sesi pengguna                                                       | Daftar node yang diizinkan                                 |
| GET /v1/latest?node_id=...       | Node yang diizinkan                                                 | Snapshot ae_sensor_context                                 |
| GET /v1/history?node_id=...      | Node yang diizinkan                                                 | Maksimal 288 pembacaan terbaru                             |
| GET /v1/alerts?node_id=...       | Node yang diizinkan                                                 | Maksimal 100 peringatan                                    |
| POST /v1/chat                    | text, node_id opsional                                              | ID job dan status                                          |
| GET /v1/jobs?id=...              | ID job milik akun                                                   | Status dan result.text                                     |
| GET /v1/rules?node_id=...        | Node yang diizinkan                                                 | Aturan node                                                |
| POST /v1/rules                   | node_id, metric, high, clear_below, unit, cooldown_seconds, enabled | Aturan tersimpan, hanya operator/admin                     |
| POST /v1/alerts/ack              | id peringatan                                                       | Status tinjauan, hanya operator/admin                      |
| GET /v1/subscriptions            | Sesi pengguna                                                       | Langganan aktif milik akun                                 |
| POST /v1/whatsapp/pair           | node_id                                                             | Perintah DAFTAR beserta kode sekali pakai                  |
| GET /v1/robots                   | Sesi pengguna                                                       | Robot pada node yang diizinkan                             |
| GET /v1/robot/state?robot_id=... | Robot yang diizinkan                                                | Caption dan status perintah terakhir                       |
| POST /v1/robot/touch             | robot_id, text                                                      | ID robot_chat milik akun                                   |
| POST /v1/robot/listen            | robot_id                                                            | ID perintah listen                                         |

## Sumber publik dan sensor

Migrasi 006 membuat satu area cache per node aktif dan mengikuti perubahan koordinat `ae_nodes`. Endpoint web hanya mengembalikan titik yang dapat diakses akun. Data publik tidak dimasukkan ke `ae_readings`, `ae_latest`, atau contoh training sensor.

Endpoint lingkungan membaca cache, tidak memanggil penyedia setiap kali halaman dibuka. Cache yang berasal dari koordinat berbeda disisihkan. Setiap fakta memiliki sumber, waktu dan batas kesegaran. Informasi yang kedaluwarsa diberi penanda data lama.

Browser memeriksa snapshot sensor setiap 30 detik, historis setiap 60 detik, cache lingkungan setiap 60 detik. Jadwal pengiriman sensor tetap ditentukan gateway, misalnya 5 menit. Membaca cache lebih sering tidak menciptakan pembacaan sensor baru.

## Layar robot

Buka `/aerobot?robot_id=ID_ROBOT` pada mini PC dan login dengan akun yang punya akses ke node robot. Teks dikirim melalui robot/touch. Tombol Mulai mendengarkan membuat perintah listen.

Agent perangkat pada mini PC tetap diperlukan untuk membaca mikrofon, infrared, wake word, memutar audio dan mengakui penyelesaian perintah. Browser tidak mendapatkan device key. Agent memakai `/v1/robot/commands`, `/v1/robot/event`, `/v1/robot/audio/:id`, dan `/v1/robot/ack` dengan credential perangkat. Memasang frontend saja belum mengaktifkan perangkat fisik.

## Penyimpanan percakapan

Worker menyimpan hasil di ae_jobs agar browser dapat mengambilnya. Jadwal maintenance pada n8n harus tetap aktif untuk retensi percakapan dan audio. Nilai retensi mengikuti fungsi maintenance database yang terpasang. Jangan menghapus historis sensor atau dataset training sebagai pengganti pembersihan chat.

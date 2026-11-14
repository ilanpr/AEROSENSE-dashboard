# Retensi operasional Supabase

Audit 21 Oktober 2026 membaca database produksi tanpa menghapus data. Hasil: database sekitar 13 MB; ae_jobs sekitar 232 kB; ae_commands sekitar 64 kB. Ukuran tabel termasuk indeks/overhead, bukan hanya isi JSON. Ini snapshot saat audit, bukan jaminan kapasitas masa depan.

Audit awal menemukan fungsi ae_maintenance lama memakai retensi tujuh hari berdasarkan created_at. Beberapa job dibuat lebih dari tujuh hari lalu; retensi baru dihitung dari updated_at agar perubahan status terbaru tetap tersedia untuk pemeriksaan. Workflow yang sudah ada adalah **AEROSENSE | Log dan snapshot training**, dengan cabang jadwal bersihkan riwayat dan cabang snapshot training mingguan yang terpisah.

## Retensi yang diterapkan

File migrasi: `server/supabase/011_operational_retention.sql`.

| Data | Retensi |
|---|---|
| Job sukses (termasuk chat, telemetry, robot) | 2 hari sejak updated_at |
| Job gagal | 7 hari sejak updated_at |
| Perintah robot selesai/kedaluwarsa | 1 hari setelah waktu terminal, hanya jika audio_path sudah kosong |
| Perintah robot gagal | 7 hari, hanya jika audio_path sudah kosong |
| Job pending/running | Tidak dihapus |
| Perintah pending/leased yang belum kedaluwarsa | Tidak dihapus |
| Sensor historis, raw/model runs, training | Dipertahankan |
| Akun, akses, pasangan robot/node, aturan, langganan | Dipertahankan |

Dua hari dipilih agar konteks menu WhatsApp 24 jam dan pemutaran jawaban web yang baru selesai tetap tersedia. Jawaban chat yang lebih tua tidak dapat diambil atau dibacakan kembali setelah dibersihkan.

Pemanggilan dilakukan melalui endpoint internal backend `/internal/maintenance`, memakai credential internal n8n yang sudah ada. Endpoint tersebut juga membersihkan audio robot yang lebih tua dari satu hari dan receipt GOWA lebih tua dari tiga puluh hari. Jangan memanggil fungsi SQL langsung sebagai pengganti endpoint bila masih ada audio di Storage; file objek harus dibersihkan sebelum baris metadata dibuang.

Jangan menjalankan seluruh file 001 untuk memperbarui retensi. Migrasi 011 hanya mengganti fungsi maintenance yang sudah ada. Setelah persetujuan pengguna, migrasi 011 berhasil diterapkan pada 21 Oktober 2026. Cabang pembersihan dipublikasikan dengan interval satu jam; trigger snapshot training mingguan dinonaktifkan. Uji endpoint berhasil dalam 1,095 detik, menghapus 2 job lama dan 2 perintah kedaluwarsa tanpa audio. Audit ulang mengonfirmasi definisi fungsi baru, tidak ada perintah tersisa, dan ukuran alokasi database tetap sekitar 13 MB.

## Jadwal dan pemantauan

- Cabang **Jadwal bersihkan riwayat** sudah aktif setiap jam pada https://flow.aerosense.me/workflow/5vT6qfY6egat2j6y. Jangan membuat jadwal kedua yang sama.
- Snapshot training mingguan adalah pekerjaan terpisah. Jangan mengaktifkannya hanya demi pembersihan log.
- Jalankan `server/scripts/storage-audit.sql` secara berkala untuk memeriksa ukuran dan usia antrean. Query hanya membaca metadata, jumlah baris, dan definisi maintenance.
- Delete biasa memungkinkan PostgreSQL memakai ulang ruang; ukuran alokasi database tidak harus langsung turun. Tidak perlu VACUUM FULL rutin karena mengunci tabel.
- Jika pertumbuhan pembacaan sensor mulai dominan, sepakati arsip/retensi sensor secara terpisah. Jangan menghapus data kajian untuk menutupi pertumbuhan log robot.

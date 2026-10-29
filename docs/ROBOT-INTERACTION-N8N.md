# n8n: wake, percakapan dan ekspresi AERO-BOT

## Batas penerapan

Workflow **AEROSENSE | Robot wake dan ekspresi** adalah sub-workflow planner, disimpan sebagai draft di https://flow.aerosense.me/workflow/1kOZFhu1WJP5ImiE. Uji manual n8n pada 22 Oktober 2026 berhasil dalam 424 ms: enam rencana diteruskan dan satu presence berulang ditahan. Trigger manual menjalankan tujuh contoh event tanpa mengakses mic, speaker, Gemini, database atau perangkat. Trigger **Dipanggil workflow robot** menerima JSON dari workflow pemanggil. Hasil selalu `dispatch:false`: belum mengantrekan perintah perangkat. Worker AERO-BOT produksi belum diubah.

Fokus pekerjaan ini adalah rencana interaksi n8n. Driver infrared, wake-word lokal, renderer wajah HDMI, lip sync dan auto-start pada mini PC ditunda sesuai permintaan pengguna.

## Urutan interaksi

| Event dan state awal | Rencana |
|---|---|
| presence, sleep | Mata tertutup → separuh terbuka → terbuka → berkedip → senyum, lalu siapkan sapaan Gemini |
| presence, sudah awake/busy | Ditahan; tidak mengulang sapaan |
| wakeword, sleep/awake/listening | Bangun bila perlu, lalu dengarkan pertanyaan |
| question, awake/listening | Hentikan capture pertanyaan, ekspresi berpikir, teruskan robot_chat |
| answer, thinking | Tunggu audio siap dan job cocok, lalu baca dengan ekspresi yang diizinkan |
| audio_finished, speaking | Buka mic untuk pertanyaan lanjutan selama 9 detik |
| idle_timeout, awake/listening | Setelah idle 120 detik, tutup mata perlahan; wake detector tetap siap |
| fault | Ekspresi error dan instruksi pemberitahuan suara yang bisa dipahami tanpa melihat layar |

Infrared hanya memberi indikasi objek/kehadiran, bukan memastikan manusia. Wake word tetap dapat membangunkan robot agar pengguna yang tidak terjangkau sensor masih punya jalur akses.

## Input dari caller

Wajib: `robot_id`, `event_id` (huruf/angka/underscore/hyphen, maksimal 80), `event`, `state`, `observed_at` ISO. Snapshot event tidak boleh lebih tua dari 30 detik atau lebih dari 5 detik ke depan. `quiet:true` menahan seluruh rencana.

Caller membaca state otoritatif terbaru dan mengirim `active_job_id`, `last_greeted_at`, `last_interaction_at` bila berlaku. `answer` memerlukan `job_id` yang cocok dengan active_job_id, teks maksimal 2000 karakter, dan `audio_ready:true`. `audio_finished` juga harus cocok dengan job aktif; ACK audio lama tidak boleh membuka mic untuk percakapan baru.

Ekspresi jawaban memakai metadata tervalidasi `answer_expression`: `neutral`, `happy`, atau `concerned`. Nilai lain menjadi neutral. Planner tidak menebak emosi dari kata kunci pada teks pertanyaan. Metadata ekspresi belum dihasilkan oleh schema Gemini produksi; saat integrasi, perlu menambah enum tersebut pada schema dan validator jawaban Robot. Ekspresi bukan klasifikasi keamanan lingkungan.

## Output dan integrasi berikutnya

Output berisi `execute`, `reason`, `next_state`, `command_id`, `expires_at` dan `steps`. `command_id` deterministik untuk satu robot/event; TTL rencana 30 detik. `next_state` adalah state yang dituju, bukan bukti perangkat telah menjalankannya.

1. Backend tetap mengautentikasi perangkat. Jangan membuka webhook n8n anonim bagi sensor. Endpoint yang tersedia: `/v1/robot/event`, `/v1/robot/commands`, `/v1/robot/audio/:id`, `/v1/robot/ack`.
2. Caller menggunakan **Execute Sub-workflow** untuk planner ini dan memeriksa output.execute. Simpan/enqueue command secara atomik dengan unique command_id; jangan memakai static data n8n sebagai jaminan dedup atau session lock.
3. Presence yang lolos memerintahkan bangun. Setelah ACK animasi bangun, caller mengantrekan sapaan pada jalur Gemini/TTS yang ada, menyimpan active_job_id dan menandai thinking selama persiapan. Status speaking baru berlaku ketika audio benar-benar mulai diputar.
4. Saat jawaban/audio siap, panggil planner dengan event answer dan state thinking. Kirim body instruksi ekspresi bersama perintah speak. Backend saat ini masih menggunakan `face:happy` pada deliver; ini harus diganti pada tahap integrasi agar membawa metadata planner. Mengimpor draft ini saja tidak mengubah perilaku worker yang lama.
5. Agent mini PC menjalankan keyframe mata selama 1,6 detik secara lokal. Gerakan mulut mengikuti amplitudo audio lokal (`local_audio_rms`), bukan token atau timer per-frame dari n8n.
6. Setelah audio selesai, agent mengirim ACK; caller memanggil audio_finished dan membuka sesi lanjutan. Timeout 9 detik adalah batas menunggu ucapan, bukan batas idle tidur. Sesudahnya kembali awake/wake-ready. Idle 120 detik hanya boleh memicu sleep jika tidak ada pertanyaan/audio/job aktif.
7. Perbarui state dan timestamp berdasarkan ACK. Cooldown sapaan minimal 120 detik dan state awake menahan deteksi berulang; uji restart, duplicate event, ACK terlambat, quiet mode dan putus jaringan sebelum mengaktifkan.

Keputusan cepat, perekaman, bunyi konfirmasi dan fallback saat offline tetap lokal pada mini PC. Tidak ada node Wait untuk animasi, dan tidak menyimpan frame wajah/rekaman standby di Supabase. Cukup state terakhir dan metadata command dengan retensi operasional yang sudah ditetapkan.

## Pemeriksaan lokal

```bash
node scripts/build-robot-interaction-workflow.mjs
node --test server/tests/robot-interaction.test.mjs
```

Import `n8n/robot-interaction.workflow.json`, jalankan **Uji simulasi tanpa perangkat**, dan periksa enam rencana yang lolos serta satu presence ulang yang ditahan. Ini pengujian planner, bukan bukti gerakan wajah, izin mic atau suara perangkat fisik.

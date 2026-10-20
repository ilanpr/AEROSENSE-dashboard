# Uji suara AERO-BOT dari laptop

Halaman `/aerobot` memakai mikrofon laptop untuk transkripsi Gemini dan speaker laptop untuk TTS Gemini. Rekaman baru dimulai ketika pengguna menekan **Rekam pertanyaan**, berhenti ketika **Selesai rekam** ditekan atau setelah 20 detik. Teks hasil transkripsi dimasukkan ke kolom pertanyaan untuk diperiksa sebelum dikirim. Klik **Dengarkan** pada jawaban atau **Tes speaker** untuk menguji suara. Rekaman dan WAV keluaran hanya ditangani di memori; tidak diunggah ke Supabase Storage.

API suara memerlukan akun. TTS jawaban memeriksa kepemilikan job dan akses node pada setiap permintaan. Endpoint tidak menerima teks TTS bebas. Tes speaker memakai kalimat tetap. Key Gemini tetap di server dan konfigurasi publik tidak memuat key.

## Pemasangan di terminal SSH Ubuntu

```bash
cd ~/AEROSENSE-dashboard
git switch feat/environment-insights
git pull --ff-only origin feat/environment-insights
revision=$(git rev-parse HEAD)
bash server/scripts/deploy-update.sh "$revision"
bash ~/aerosense-api/scripts/setup-web-voice.sh
docker compose up -d --build web
curl -fsS http://127.0.0.1:8082/api/health
```

`setup-web-voice.sh` menemukan container service n8n aktif, memakai credential Gemini yang sudah ada pada server, membuat backup `.env`, dan mengaktifkan ulang API. Credential tidak dicetak. Ekspor sementara dihapus saat script selesai. Jika ada beberapa credential Gemini, script hanya memilih credential bernama AEROSENSE yang unik; bila ambigu, script berhenti tanpa mengubah `.env`.

Default: `GEMINI_TEXT_MODEL=gemini-3.1-flash-lite`, `GEMINI_TTS_MODEL=gemini-3.8-flash-tts`, `GEMINI_TTS_VOICE=Kore`. Model dapat disesuaikan pada `.env` backend jika akses model project berbeda. Implementasi mengikuti [Gemini speech generation REST API](https://ai.google.dev/gemini-api/docs/speech-generation).

Mic memerlukan HTTPS atau localhost. Reverse proxy web mengizinkan `microphone=(self)`, sehingga browser tetap meminta izin pengguna. Jika browser menahan pemutaran otomatis setelah respons TTS, klik **Dengarkan** lagi. Pengujian fisik mic, transkripsi model, dan speaker baru terkonfirmasi setelah dicoba pada laptop dengan backend yang sudah dipasang.

## Data Hub Lingkungan

Web membaca API setiap 60 detik. Workflow Hub yang dipublikasikan mengambil sumber per jadwal: cuaca/tanah permukaan, FIRMS dan gempa per jam; model udara per 3 jam; debit sungai per hari. SoilGrids, BMKG cuaca dan IQAir mengikuti konfigurasi opsional. Ini pembaruan berkala sesuai penyedia, bukan pembacaan sensor tiap detik. `valid_at`, `fresh_until`, status gagal, dan jadwal sumber ditampilkan agar data lama tidak diberi label terbaru.

Perencana memberi toleransi satu menit sebelum `refresh_after`, sehingga pemicu tiap jam tidak melewatkan pembaruan hanya karena beberapa detik lebih awal dari waktu pengambilan sebelumnya. Status dan fakta yang lewat masa berlaku tetap diperiksa backend.

Pada 20 Oktober 2026, perbaikan tersebut sudah dipublikasikan pada workflow **AEROSENSE | Hub lingkungan**. Workflow **AEROSENSE | Jawaban website** juga memakai pilihan model tetap `models/gemini-3.1-flash-lite`, sesuai jalur WhatsApp yang sudah bekerja. Pengujian fisik berikutnya perlu memakai pertanyaan baru karena jawaban fallback lama tetap tersimpan pada job lama.

```bash
cd ~/aerosense-api
docker compose exec -T aerosense-api node scripts/check-environment.mjs
```

Periksa `environment_providers` untuk waktu percobaan, jadwal berikut, fakta masih berlaku, fakta lama, kategori, dan waktu data. Respons HTTP 200 saja belum membuktikan setiap sumber masih baru. `public_nodes: 0` berarti guest belum mempunyai node yang dipublikasikan; login untuk membaca node akun, atau terbitkan node yang memang disetujui pengelola.

`https://aerosense.me/api/health` harus mengembalikan JSON `{"status":"ok"}`. Jika HTML dikembalikan, hostname masih mengarah ke origin/rute yang salah. Arahkan layanan web Cloudflare ke container/origin web port 8082 yang memiliki proxy `/api/`, lalu periksa lagi. Jangan memakai keberhasilan localhost sebagai bukti domain publik sudah terhubung.

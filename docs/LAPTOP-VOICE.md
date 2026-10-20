# Uji suara AERO-BOT dari laptop

## Mode suara tanpa tombol (untuk pengguna disabilitas)

Di halaman `/aerobot`, tekan **Aktifkan mode suara tanpa tombol** satu kali. Setelah itu tidak ada tombol yang perlu ditekan:

1. Ucapkan **“Halo AERO-BOT”**. Bunyi “ting-ting” menandakan AERO-BOT mendengarkan. Pertanyaan boleh langsung disambung dalam satu kalimat, misalnya “Halo AERO-BOT, bagaimana kualitas udara hari ini?”.
2. Saat pengguna berhenti bicara sekitar 1 detik, rekaman pertanyaan otomatis dikirim ke Gemini untuk transkripsi, lalu ke alur jawaban website (n8n).
3. Jawaban langsung dibacakan dengan TTS Gemini. Jika TTS Gemini gagal, jawaban dibacakan dengan suara bawaan perangkat.
4. Selama 8 detik setelah jawaban selesai, pertanyaan lanjutan bisa langsung diucapkan tanpa “Halo AERO-BOT”.

Tekan **Esc** atau **Hentikan suara** untuk menghentikan pembacaan. Pilihan mode disimpan di browser. Setelah halaman dimuat ulang, browser memerlukan satu sentuhan atau satu tombol keyboard untuk menyalakan audio.

Deteksi kata “Halo AERO-BOT” memakai pengenal suara bawaan Chrome/Edge (`id-ID`), sehingga hanya pertanyaan yang dikirim ke Gemini. Pada browser tanpa pengenal suara, setiap ucapan pendek dikirim ke Gemini untuk memeriksa kata panggilan. Deteksi akhir bicara (VAD) berjalan lokal di browser. Jika Gemini sibuk (HTTP 503), backend mencoba ulang lalu memakai model cadangan `GEMINI_TRANSCRIBE_FALLBACK_MODELS` (bawaan `gemini-3.5-flash-lite,gemini-2.5-flash-lite`). Bila semuanya gagal, transkrip pengenal suara browser dipakai sebagai cadangan.

Untuk layar robot/kiosk tanpa interaksi, jalankan Chrome dengan `--autoplay-policy=no-user-gesture-required` dan izinkan mikrofon untuk situs tersebut, agar mode suara aktif tanpa sentuhan setelah dimuat ulang.

## Mode rekam manual

Tombol **Rekam pertanyaan** tetap tersedia. Setelah **Selesai rekam**, pertanyaan langsung dikirim dan jawabannya dibacakan otomatis. Rekaman berhenti otomatis setelah 20 detik. Rekaman dan WAV keluaran hanya ditangani di memori; tidak diunggah ke Supabase Storage.

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

Default: `GEMINI_TEXT_MODEL=gemini-3.1-flash-lite`, `GEMINI_TRANSCRIBE_MODEL` (opsional, bawaan sama dengan model teks), `GEMINI_TRANSCRIBE_FALLBACK_MODELS=gemini-3.5-flash-lite,gemini-2.5-flash-lite`, `GEMINI_TTS_MODEL=gemini-3.8-flash-tts`, `GEMINI_TTS_VOICE=Kore`. Model dapat disesuaikan pada `.env` backend jika akses model project berbeda. Implementasi mengikuti [Gemini speech generation REST API](https://ai.google.dev/gemini-api/docs/speech-generation).

Mic memerlukan HTTPS atau localhost. Reverse proxy web mengizinkan `microphone=(self)`, sehingga browser tetap meminta izin pengguna. Jika browser menahan pemutaran otomatis setelah respons TTS, klik **Dengarkan** lagi atau sentuh layar sekali. Pengujian fisik mic, transkripsi model, dan speaker baru terkonfirmasi setelah dicoba pada laptop dengan backend yang sudah dipasang.

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

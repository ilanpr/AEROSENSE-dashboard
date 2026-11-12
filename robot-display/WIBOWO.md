# Suara robot dengan Wibowo (TTS lokal, tanpa token)

AERO-BOT bisa berbicara memakai model Wibowo dari [TTS-Indonesia-Gratis](https://github.com/drat/TTS-Indonesia-Gratis), berjalan di mini PC robot. Server hanya mengirim teks; mini PC yang mengubahnya menjadi suara. Tidak ada biaya Gemini TTS untuk robot.

`tts-wibowo.py` mengunduh kode sumber pada commit tetap dan checkpoint `checkpoint_1260000-inference.pth`, lalu memeriksa checksum SHA-256 keduanya. Layanan hanya mendengarkan di `127.0.0.1:4220` dan memerlukan kunci acak yang dibuat oleh `start.mjs`.

## Pasang di mini PC (sekali)

1. Python 3.11 sampai 3.12, 64-bit.
2. Dari folder `robot-display`:

```bash
python -m venv .venv-wibowo
.venv-wibowo/Scripts/python -m pip install -r requirements-wibowo.txt
.venv-wibowo/Scripts/python tts-wibowo.py --prepare
```

Di Linux, ganti `Scripts` dengan `bin`. Unduhan pertama sekitar beberapa ratus MB.

3. Jalankan robot dengan variabel `AEROBOT_TTS_PYTHON` berisi path Python tadi, misalnya `AEROBOT_TTS_PYTHON=.venv-wibowo/Scripts/python`. `start.mjs` menyalakan Wibowo otomatis dan mematikannya saat robot berhenti.

## Aktifkan di server

Di `.env` API, isi `ROBOT_TTS=local`, lalu rebuild API. Jawaban chat dan pesan kondisi 15 menitan dikirim tanpa audio cloud; robot membacakannya dengan Wibowo. Kosongkan `ROBOT_TTS` untuk kembali ke Gemini TTS.

Jika `ROBOT_TTS=local` tetapi mini PC belum menjalankan Wibowo, perintah bicara ditandai gagal dan robot tidak bersuara.

## Batas

Wibowo berjalan di CPU. Kecepatan bergantung pada prosesor mini PC; kalimat panjang butuh beberapa detik. Tombol "Dengarkan" di web masih memakai Gemini TTS karena berjalan di server, bukan di mini PC.

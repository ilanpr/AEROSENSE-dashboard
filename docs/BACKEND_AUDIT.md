# Pemeriksaan sistem AEROSENSE

Diperiksa 18 Oktober 2026. Kode web/backend dan draft di instance `flow.aerosense.me` diperiksa terpisah dari penerapan pada Ubuntu.

## Yang sudah diubah

- Hayati dihapus dari halaman, ringkasan, normalisasi, perencana pengambilan dan node GBIF di Hub n8n. Cache GBIF lama tidak dihapus, tetapi tidak dibaca sebagai konteks.
- API publik lingkungan dibatasi ke acuan Surabaya, `-7.24917, 112.75083`. Koordinat sensor tetap memakai node asli.
- SoilGrids tidak dijadwalkan kecuali diaktifkan. Data kelembapan tanah Open-Meteo tetap dikumpulkan.
- Node IQAir dinonaktifkan karena credential belum diisi. Untuk memakainya: pasang credential, aktifkan node dan set `iqair_enabled=true`. Setelah dinonaktifkan, tombol Publish Hub tersedia.
- Kabar bencana Indonesia memakai ANTARA dan GDACS dengan cache Supabase. Migrasi 005 sudah dijalankan; RLS aktif, tidak ada akses SELECT langsung untuk anon.
- Konteks serta validasi jawaban Web, Robot dan WhatsApp kini mendukung referensi berita nasional. Tidak ada panggilan Gemini tambahan untuk klasifikasi topik.
- Judul dan copy dipersingkat. Sumber serta rincian tetap tersedia melalui disclosure. Kartu promosi AERO-BOT dihapus.

## Alur yang berjalan otomatis setelah dipasang

| Bagian | Pemicu | Data masuk | Hasil |
|---|---|---|---|
| Data sensor | Gateway mengirim HTTP | Raw input, pembacaan, waktu, GRU/model | `ae_readings`, snapshot sensor, job telemetry |
| Control Center | NOTIFY `aerosense_events` | `job_id`, `kind` | Memanggil worker sesuai jenis pekerjaan |
| Pemulihan | Jadwal Control Center | Jenis job siap dari `ae_ready_kinds()` | Mengambil job tertunda atau lease habis |
| Data udara | Sub-workflow telemetry | ID pembacaan | Evaluasi ambang dan antrekan peringatan |
| Jawaban website | Sub-workflow web_chat | Pertanyaan dan akses node | Jawaban di `ae_jobs.result`, lalu dibaca web |
| AERO-BOT | Sub-workflow robot_chat | Teks, audio atau presence | STT bila diperlukan, jawaban, TTS, `ae_commands` |
| WhatsApp | Pesan masuk / job | Pesan, menu, langganan, peringatan | Balasan atau template melalui Meta |
| Hub lingkungan | Jadwal per jam | Area Surabaya dan masa cache | `ae_environment_area_cache` |
| Berita bencana | Backend mulai + 15 menit | Feed ANTARA/GDACS | `ae_disaster_news_cache` |
| Snapshot training | Jadwal mingguan | Pembacaan aktual tujuh hari | `ae_training_sets` dan `ae_training_examples` |
| Perawatan | Jadwal per jam | Job, command, audio, kode kedaluwarsa | Pembersihan sesuai retensi |

Control Center menggunakan **Wait for Sub-workflow Completion = false** untuk Data udara, Web, WhatsApp dan Robot. Satu layanan tidak menunggu jawaban layanan lain. Tetap ada batas CPU, koneksi database dan kuota penyedia; pengaturan ini tidak menjanjikan tanpa antrean pada beban berapa pun.

Job diklaim dengan lease dan `SKIP LOCKED`. Penyimpanan stage memperpanjang lease. NOTIFY bukan antrean tahan putus, sehingga jadwal pemulihan tetap diperlukan. Riwayat job selesai/gagal dibersihkan setelah tujuh hari oleh maintenance; data pembacaan untuk kajian model tetap disimpan.

## Sambungan yang diperiksa

ID pemanggilan Control Center cocok dengan workflow pada instance ini:

| Worker | ID |
|---|---|
| Data udara | `Szi9m7z2Bj6pZqXI` |
| Jawaban website | `v5xdFpjxQYUrKk9g` |
| WhatsApp | `ddNDGrNx3Pi4SrZ2` |
| AERO-BOT | `Fq5YVWq6Rq0wdfcg` |
| Hub lingkungan | `lTIFDJVNLP6QKNUN` |
| Log dan snapshot training | `5vT6qfY6egat2j6y` |

Endpoint HTTP internal pada worker Web, Robot, WhatsApp dan Data udara ditemukan pada backend. Ini pemeriksaan kontrak kode, bukan bukti panggilan produksi berhasil. Credential terpasang pada node Postgres, Gemini dan HTTP internal yang diperiksa; validitas credential memerlukan eksekusi nyata.

Empat node WhatsApp belum memiliki credential: `WhatsApp pesan masuk`, `WhatsApp kirim pesan`, `WhatsApp kirim peringatan template`, dan `WhatsApp kirim menu interaktif`. Nomor Business, webhook Meta, template yang disetujui dan persetujuan penerima masih perlu disiapkan sebelum jalur WhatsApp dianggap siap.

## Yang belum otomatis hanya dengan Publish web

1. **Backend Ubuntu perlu diperbarui.** Source lokal bukan source container yang sedang berjalan. SSH ke server dapat dijangkau, tetapi login otomatis ditolak. Deployment belum dilakukan pada pemeriksaan ini.
2. **Control Center, Hub dan jadwal perawatan perlu dipublikasikan.** Control Center menunjukkan Unpublish tidak tersedia. Pengeditan di n8n disimpan sebagai draft. Periksa versi yang dipakai oleh pemanggilan sub-workflow pada versi n8n terpasang.
3. **Postgres Trigger perlu koneksi direct/session yang mendukung LISTEN.** Transaction pooler tidak boleh diasumsikan mendukung listener yang menetap.
4. **WhatsApp belum lengkap.** Jangan mengaktifkan pengiriman sampai credential, template dan opt-in siap.
5. **BMKG cuaca memerlukan ADM4. IQAir memerlukan key.** Keduanya opsional; Open-Meteo tetap menyediakan sumber cuaca/udara utama.
6. **Sensor dan perangkat robot perlu uji fisik.** Node belum mengirim pembacaan nyata. INMP441/MAX98357A memerlukan penghubung perangkat yang sesuai; browser mini PC tidak menerima sambungan I2S secara langsung.
7. **Snapshot training bukan pelatihan otomatis.** Validasi, pelatihan dan persetujuan model tetap proses terpisah. Berita/API publik tidak otomatis dijadikan target aktual sensor.

`/health` memeriksa proses API. `check-db.mjs` memeriksa akses tabel. Keduanya belum membuktikan chat, audio, jadwal atau WhatsApp bekerja sampai tujuan akhir.

## Urutan penerapan

1. Perbarui backend sesuai [DEPLOYMENT.md](DEPLOYMENT.md), pertahankan `.env`, lalu build ulang.
2. Periksa `/health`, jalankan `scripts/check-db.mjs`, lalu buka `/v1/disasters` dan `/v1/environment`.
3. Uji Hub manual. Pastikan setiap sumber mencatat waktu, koordinat dan status yang sesuai. Sumber gagal tidak boleh menjadi angka nol palsu.
4. Uji satu job Web, tunggu status done dan pastikan jawabannya muncul pada akun pengirim.
5. Publish versi worker yang akan dipakai, lalu Control Center, Hub dan perawatan. Pastikan jadwal mengikuti zona waktu Jakarta.
6. Uji dua pertanyaan dari sesi berbeda. ID job dan hasil harus tetap terpisah.
7. Deploy web, cek route `/dashboard`, `/environment`, `/aerobot` serta `/api/v1/disasters` dari domain.
8. Uji perangkat robot dan WhatsApp setelah konfigurasi masing-masing selesai.

## Bukti pengujian

- Pengujian otomatis mencakup akses akun/lokasi, audit ESG khusus admin, tanda tangan webhook, format audio, filter sumber, cache, konteks dan validasi referensi berita.
- Feed ANTARA dan GDACS diambil langsung. Filter menghasilkan berita Indonesia dan notifikasi IDN, dengan metadata sumber/waktu.
- Pratinjau web memakai pembacaan sensor/cuaca sintetis yang diberi label. Berita asli hanya dipakai saat `PREVIEW_LIVE_NEWS=true`; cache pratinjau berada di memori lokal.
- Build frontend dan lint dijalankan sebelum perubahan dikirim. Hasil ini tidak menyatakan backend Ubuntu sudah diperbarui atau sensor fisik telah bekerja.

Dokumentasi n8n: [Save and publish](https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows.md), [Execute Sub-workflow](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executeworkflow).

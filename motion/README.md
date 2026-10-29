# AEROSENSE atmosphere

Loop dekoratif untuk panel sensor dan hub lingkungan. Tidak memuat angka atau status lingkungan.

```powershell
pnpm install
pnpm exec remotion studio
pnpm exec remotion render Atmosphere ../public/assets/environment/atmosphere.mp4 --codec=h264 --crf=28 --concurrency=2
```

Komposisi: 960 × 540, 24 fps, 192 frame. Phase gerak kembali ke posisi awal untuk loop 8 detik. File hasil dipakai melalui video native pada web; package ini tidak diimpor oleh aplikasi utama.

Lihat `../docs/ENVIRONMENT_VISUALS.md` untuk aset, pemilihan kondisi dan kontrol gerak.

# Layar TFT 1,8" AEROSENSE (ESP32-S3)

Modul: TFT 1,8 inci 128×160 SPI, chip ST7735S, 8 pin (GND, VCC, SCL, SDA, RES, DC, CS, BL). Layar putih saat dinyalakan berarti backlight hidup tetapi chip layar belum diinisialisasi; itu normal sebelum firmware dipasang.

Firmware di `firmware/tft-display/` menampilkan logo AEROSENSE selama sekitar 2,5 detik, lalu pembacaan terbaru satu node dari API publik dan memperbaruinya tiap 30 detik.

## Sambungan kabel

| Pin modul | ESP32-S3 | Keterangan |
|---|---|---|
| GND | GND | |
| VCC | 3V3 | |
| SCL | GPIO 12 | SPI clock |
| SDA | GPIO 11 | SPI data (MOSI) |
| RES | GPIO 8 | reset |
| DC | GPIO 9 | data/command (kadang ditulis A0) |
| CS | GPIO 10 | chip select |
| BL | GPIO 7 | backlight; boleh langsung ke 3V3 lalu `TFT_BL -1` |

Pin dapat diganti di `config.h`. Hindari GPIO 0, 3, 45, 46 (strapping) serta 26–37 pada board dengan flash/PSRAM octal.

## Pemasangan

1. Arduino IDE: pasang board **esp32** (Espressif, core 3.x) dan pilih board ESP32-S3 Anda.
2. Library Manager: **Adafruit ST7735 and ST7789 Library**, **Adafruit GFX Library**, **ArduinoJson** 7.
3. Salin `config.example.h` menjadi `config.h`, isi Wi-Fi. Biarkan `NODE_ID` = `demo-its-01` untuk uji pertama (node simulasi yang sudah publik).
4. Upload `tft-display.ino`. Logo tampil, lalu data node.

## Tampilan

- Header: nama node, tanda **LIVE** (data baru), **LAMA** (data lama atau server tidak terjangkau), atau **TIDAK VALID**, serta jam pembacaan WIB.
- Nilai utama: debu optik µg/m³, atau PM2.5 hanya bila node ditandai tervalidasi. Label **BAIK/WASPADA/BAHAYA** mengikuti ambang `high` dan `danger_high` node; tanpa ambang tidak ada label.
- eCO2, TVOC, suhu, dan kelembapan.
- Jika server tidak terjangkau, nilai terakhir tetap tampil dengan tanda LAMA.

## Memakai node sendiri

Layar membaca `/v1/public/nodes?node_id=...` tanpa login, jadi node harus dipublikasikan. Data node publik dapat dibaca siapa saja; pastikan pengelola menyetujui. Di Supabase SQL Editor:

```sql
update public.ae_nodes set public_read = true where id = 'ID-NODE-ANDA';
```

Lalu ganti `NODE_ID` di `config.h` dan upload ulang.

## Jika gambar belum benar

| Gejala | Coba |
|---|---|
| Tetap putih | Periksa kabel SCL, SDA, CS, DC, RES dan nomor pin di `config.h`. |
| Gambar bergeser atau ada garis acak di tepi | `TFT_TAB INITR_GREENTAB` |
| Merah dan biru tertukar | `TFT_TAB INITR_REDTAB` |
| Semua warna terbalik | `TFT_INVERT 1` |
| "Server tidak terjangkau" | Wi-Fi tanpa internet, atau `API_BASE` salah. |
| "Node belum dipublikasikan" | Jalankan SQL di atas atau periksa `NODE_ID`. |

HTTPS memakai `setInsecure()` karena data yang dibaca publik dan tidak ada rahasia yang dikirim. Untuk pemasangan permanen, sertifikat server dapat dipasang dengan `setCACert()`.

## Uji tanpa perangkat

`bash firmware/tft-display/test/run.sh` menggambar layar memakai kode Adafruit GFX asli dan menyimpan PNG di `firmware/tft-display/test/out/`. Logo dibuat dari `public/assets/aerosense-logo.svg` oleh `tools/make_logo.py`.

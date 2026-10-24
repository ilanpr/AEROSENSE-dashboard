# Node sensor AEROSENSE dengan layar TFT

Firmware `firmware/sensor-node/` untuk ESP32-S3 dengan SGP30, Sharp GP2Y1010AU0F, AM2301 (DHT21), modul LoRa EBYTE E220-900T22D dan layar TFT 1,8" 128×160 (ST7735S). Layar dipasang tegak (portrait 128×160) dan membaca sensor langsung di node, tanpa Wi-Fi atau server:

1. Logo AEROSENSE selama sekitar 3 detik saat menyala.
2. Debu optik (rata-rata bergerak 10 detik), eCO2, TVOC, suhu, kelembapan; diperbarui tiap detik.
3. Label **BAIK / WASPADA / BAHAYA** dari ambang debu lokal di `config.h`.
4. Status LoRa di header dan hitung mundur pengiriman berikutnya.

Setiap `SEND_INTERVAL_S` (bawaan 5 menit) node mengirim satu baris CSV ke gateway, sesuai format di `PANDUAN_LENGKAP_AEROSENSE.md`:

```
NODE_SIDOMORO_01,81,31.2,610,145,42.1,78.5
node_id,counter,suhu,eco2_raw,tvoc_raw,pm25_raw,kelembapan
```

Debu yang dikirim adalah rata-rata selama interval. eCO2 dan TVOC dikirim `nan` selama 15 detik pemanasan SGP30. Nilai sensor yang gagal dibaca juga dikirim `nan`.

## Sambungan

| Komponen | Pin komponen | ESP32-S3 |
|---|---|---|
| SGP30 | SDA / SCL | GPIO 8 / 9 |
| AM2301 / AM2302 | Data (pull-up 4,7–10 kΩ ke 3V3) | GPIO 5 |
| Sharp GP2Y1010 | LED (lewat resistor 150 Ω + kapasitor 220 µF sesuai datasheet) | GPIO 4 |
| Sharp GP2Y1010 | Vo | GPIO 1 (ADC1) |
| E220 | TXD → ESP RX / RXD ← ESP TX | GPIO 18 / 17 |
| E220 | M0, M1 | GND (mode transparan) |
| E220 | AUX | GPIO 16 |
| Baterai 18650 | B+ lewat pembagi 100k/100k | GPIO 2 (hanya log Serial) |
| TFT | SCL / SDA | GPIO 12 / 11 |
| TFT | CS / DC / RES | GPIO 10 / 13 / 14 |
| TFT | BL | GPIO 21 (atau 3V3, lalu `TFT_BL -1`) |
| TFT | VCC / GND | 3V3 / GND |

Sharp memberi Vo hingga sekitar 3,6 V, sedangkan ADC ESP32 aman sampai 3,3 V. Pakai pembagi tegangan (misalnya 10 kΩ atas + 20 kΩ bawah) lalu isi `SHARP_DIVIDER 1.5`.

## Pemasangan

1. Arduino IDE: board **esp32** (Espressif, core 3.x), pilih **ESP32S3 Dev Module** atau board Anda.
2. Library Manager: **Adafruit ST7735 and ST7789**, **Adafruit GFX**, **Adafruit SGP30**, **DHT sensor library** (Adafruit, beserta Adafruit Unified Sensor).
3. Di `firmware/sensor-node/` salin `config.example.h` menjadi `config.h`. Isi `NODE_ID` sama dengan ID node di Supabase, serta `DUST_WARNING` dan `DUST_DANGER` sama dengan aturan node (`high`, `danger_high`) supaya layar dan dashboard sejalan.
4. Upload `sensor-node.ino`. Serial Monitor 115200 menampilkan pin yang dipakai saat menyala, satu baris `Baca | ...` tiap 5 detik (`SERIAL_LOG_S`), dan setiap baris yang dikirim (`LoRa TX ...`). Untuk uji cepat, isi sementara `SEND_INTERVAL_S 10`.

## Kalibrasi debu

Setelah node menyala 10 menit di udara bersih, catat Vo dari Serial atau layar, lalu sesuaikan `SHARP_ZERO_V` sampai debu terbaca mendekati 0. Konversi memakai sensitivitas tipikal datasheet 0,5 V per 0,1 mg/m³. Debu optik belum setara PM2.5 tervalidasi; perbandingan dengan SPS30 tetap diperlukan.

## Indikator LoRa

Dalam mode transparan, E220 tidak memberi tahu apakah gateway menerima paket.

| Header | Arti |
|---|---|
| `LORA ...` | Belum ada paket terkirim sejak menyala |
| `LORA TX` | Paket terkirim (`ACK_MODE 0`); penerimaan gateway tidak diketahui |
| `LORA -87` / `LORA OK` | Gateway membalas ACK; angka adalah RSSI dBm bila gateway mengirimnya |
| `LEMAH -112` | ACK diterima tetapi sinyal di bawah `LORA_WEAK_BELOW`, atau satu ACK terlewat |
| `LORA PUTUS` | `LORA_LOST_AFTER` paket berturut-turut tanpa ACK |

Untuk indikator kualitas yang sebenarnya, aktifkan `ACK_MODE 1` dan tambahkan balasan di penerima gateway (`lora_receiver.py`) setelah satu baris diterima:

```python
parts = line.strip().split(",")
if len(parts) >= 2:
    ser.write(f"ACK,{parts[0]},{parts[1]}\n".encode())
```

Jika modul E220 gateway diatur dengan **RSSI byte** aktif, byte setelah setiap paket berisi RSSI; kirim sebagai kolom keempat (`ACK,<node>,<counter>,<rssi_dbm>`, dengan rssi_dbm = −(256 − nilai byte)). Node dan gateway harus berada pada channel dan alamat E220 yang sama.

## Uji tanpa perangkat

`bash firmware/sensor-node/test/run.sh` memeriksa logika node (konversi debu, label, CSV, ACK, status link) dan menggambar layar memakai kode Adafruit GFX asli ke `firmware/sensor-node/test/out/`.

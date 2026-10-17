# API publik AEROSENSE

## Lokasi

Acuan API publik: Kota Surabaya, latitude -7.24917, longitude 112.75083, zona waktu Asia/Jakarta. Ini acuan kota, bukan GPS pengguna. Data sensor sendiri tetap mengikuti lokasi node di ae_nodes. Data publik disimpan terpisah melalui ae_environment_areas dan ae_environment_area_cache.

## 1. Open-Meteo cuaca dan tanah

API key: tidak diperlukan untuk endpoint gratis nonkomersial.

```text
https://api.open-meteo.com/v1/forecast?latitude=-7.24917&longitude=112.75083&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&hourly=soil_temperature_0cm,soil_moisture_0_to_1cm&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max&forecast_days=2&timezone=Asia%2FJakarta
```

Mengambil suhu, kelembapan, hujan, angin, UV, suhu tanah dan kelembapan tanah. Data tanah merupakan keluaran model, bukan sensor tanah robot.

## 2. Open-Meteo kualitas udara

API key: tidak diperlukan.

```text
https://air-quality-api.open-meteo.com/v1/air-quality?latitude=-7.24917&longitude=112.75083&domains=cams_global&current=pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi&forecast_days=1&timezone=Asia%2FJakarta
```

Data model regional CAMS, bukan pembacaan node AEROSENSE. US AQI tidak sama dengan ISPU.

## 3. Open-Meteo debit sungai

API key: tidak diperlukan.

```text
https://flood-api.open-meteo.com/v1/flood?latitude=-7.24917&longitude=112.75083&daily=river_discharge&forecast_days=3
```

Prakiraan debit sungai dari model. Bukan konfirmasi banjir di sekitar pengguna.

## 4. BMKG prakiraan cuaca

API key: tidak diperlukan. Harus mengisi kode ADM4 kelurahan yang valid.

```text
https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=KODE_KELURAHAN_SURABAYA
```

Placeholder harus diganti. Workflow melewati sumber ini selama bmkg_adm4_by_area belum diisi. Jangan memilih kode secara acak.

## 5. BMKG gempa

API key: tidak diperlukan.

```text
https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json
```

Daftar gempa M5 ke atas. Workflow menyaring jaraknya terhadap area acuan. Tidak adanya hasil dalam radius tidak berarti tidak ada gempa kecil.

## 6. NASA FIRMS titik panas

API key: tidak diperlukan untuk CSV publik yang dipakai workflow.

```text
https://firms.modaps.eosdis.nasa.gov/data/active_fire/viirs/csv/SUOMI_VIIRS_C2_SouthEast_Asia_24h.csv
```

CSV Asia Tenggara disaring berdasarkan koordinat area. Titik panas satelit bukan konfirmasi kebakaran di lapangan. Jika nanti menggunakan FIRMS Area API, buat MAP_KEY di https://firms.modaps.eosdis.nasa.gov/api/map_key/ . MAP_KEY belum dibutuhkan untuk URL CSV di atas.

## 7. IQAir

API key: diperlukan. Buat dari akun sendiri di https://dashboard.iqair.com/ . Pilih paket sesuai kebutuhan dan batas akses yang tersedia.

```text
https://api.airvisual.com/v2/nearest_city?lat=-7.24917&lon=112.75083
```

Di node HTTP IQAir, pilih Generic Credential Type > Query Auth. Buat credential dengan Name: key dan Value: API key IQAir. Credential menambahkan parameter key ke request. Setelah credential dipilih, aktifkan iqair_enabled. Jangan kirim key ke chat atau simpan di kode frontend. Sumber ini masih dinonaktifkan sampai key dipasang.

## 9. SoilGrids profil tanah

API key: tidak diperlukan, tetapi REST API sedang dihentikan sementara oleh ISRIC. Jangan mengandalkannya untuk pengujian sekarang.

```text
https://rest.isric.org/soilgrids/v2.0/properties/query?lon=112.75083&lat=-7.24917&property=phh2o&property=soc&property=clay&property=sand&depth=0-5cm&value=mean
```

Target data: pH, karbon organik, liat dan pasir. Wilayah perkotaan dapat tidak memiliki nilai. Suhu atau kelembapan tanah Open-Meteo tidak menggantikan data pH SoilGrids.

## Pengaturan HTTP n8n

- Method: GET untuk seluruh URL publik di atas.
- Authentication: None, kecuali IQAir memakai Query Auth.
- Jangan pasang credential AEROSENSE Internal API atau Gemini pada endpoint publik.
- URL node hub saat ini dibuat oleh JavaScript planner melalui $json.url. Daftar ini untuk memahami dan menguji endpoint; tidak perlu mengganti seluruh expression URL dengan teks statis.
- Pertahankan sumber, koordinat permintaan, waktu data dan status ketersediaan saat menyimpan cache.
- Gemini membaca konteks yang sudah diambil dan disaring workflow. Gemini tidak otomatis mengambil semua URL sendiri.

## Credential aplikasi yang terpisah

- Backend internal Docker: http://aerosense-api:8080 . Gunakan credential AEROSENSE Internal API dengan header X-Aerosense-Internal-Key yang sama dengan konfigurasi server.
- Gemini: gunakan credential Google Gemini yang sudah dibuat.
- Supabase/Postgres: gunakan credential database yang sudah dibuat. Service-role key tetap di server.
- WhatsApp: membutuhkan credential Meta WhatsApp dan konfigurasi nomor/webhook secara terpisah.

## Batas verifikasi

Konfigurasi area publik Surabaya sudah disimpan pada hub dan worker web, robot, serta WhatsApp. Hub pernah berhasil dijalankan manual. Ini belum membuktikan semua sumber tersedia: IQAir menunggu key, BMKG cuaca menunggu ADM4, SoilGrids sedang tidak tersedia. Integrasi jawaban AI ke frontend produksi masih perlu pengujian menyeluruh.

Dokumentasi: https://open-meteo.com/en/docs , https://open-meteo.com/en/docs/air-quality-api , https://open-meteo.com/en/docs/flood-api , https://data.bmkg.go.id/ , https://firms.modaps.eosdis.nasa.gov/ , https://api-docs.iqair.com/ , https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html


## Kabar bencana Indonesia

Feed ANTARA dan GDACS, batas cakupan, serta alur cache: [DISASTER_NEWS.md](DISASTER_NEWS.md). Tidak memerlukan API key.

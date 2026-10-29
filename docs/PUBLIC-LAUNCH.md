# Publikasikan web terbaru ke aerosense.me

Semua perintah di bawah dijalankan di terminal SSH Ubuntu, bukan PowerShell Windows. Cloudflare Tunnel harus berjalan di server Ubuntu agar web tetap tersedia saat laptop ditutup. Tidak perlu menjalankan quick tunnel trycloudflare.

## 1. Perbarui web

```bash
cd ~/AEROSENSE-dashboard && git switch feat/environment-insights && git pull --ff-only origin feat/environment-insights && docker compose up -d --build web
```

Tunggu container selesai mulai. Kemudian periksa:

```bash
curl --fail http://127.0.0.1:8082/api/health
```

Hasil yang benar adalah JSON `{"status":"ok"}`. Jika koneksi gagal sesaat setelah build, tunggu beberapa detik lalu ulangi pemeriksaan. Jangan ubah route publik sebelum pemeriksaan ini berhasil.

## 2. Tentukan lokasi connector Cloudflare yang sudah ada

```bash
systemctl is-active cloudflared
```

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Networks}}'
```

Cari connector yang melayani tunnel domain ini di dashboard Cloudflare dan cocokkan dengan server. Jangan membuat tunnel baru bila tunnel yang lama masih sehat. Jangan membagikan token connector atau output konfigurasi yang memuat token.

## 3. Arahkan domain ke web baru

Buka Cloudflare Dashboard > Networking > Tunnels, lalu pilih tunnel domain AEROSENSE. Pada tampilan Zero Trust lama, menu ini dapat muncul di Networks > Connectors. Buka Published application routes / Public hostnames. Catat tujuan lama untuk rollback, lalu edit route aerosense.me:

| Kolom | Nilai |
|---|---|
| Subdomain | Kosong untuk domain utama |
| Domain | aerosense.me |
| Path | Kosong agar seluruh path ikut diproksi |
| Service type | HTTP |

Pilih **satu** service URL sesuai lokasi connector:

- **cloudflared sebagai service host Ubuntu:** `127.0.0.1:8082`.
- **cloudflared sebagai container Docker:** `aerosense-web-web-1:80`, bila nama container web hasil `docker compose ps` memang demikian. Kedua container harus terhubung ke network `n8n_default`. `localhost:8082` di dalam container connector bukan localhost Ubuntu.

Untuk memeriksa nama container web:

```bash
cd ~/AEROSENSE-dashboard && docker compose ps web
```

Jika connector Docker belum berada pada network tersebut, ganti `NAMA_CONTAINER_CLOUDFLARED` dengan nama yang benar dari `docker ps`:

```bash
docker network connect n8n_default NAMA_CONTAINER_CLOUDFLARED
```

Simpan route. Jika ada route khusus `/api` pada hostname yang sama, pastikan route itu juga menuju web baru; nginx web sudah meneruskan `/api/` ke backend. Pertahankan route flow.aerosense.me untuk n8n. Tidak perlu mempublikasikan port backend atau dashboard GOWA.

## 4. Pastikan origin dan login sesuai domain

Konfigurasi `WEB_ORIGINS` backend harus mencakup `https://aerosense.me`, dengan tetap mempertahankan origin lain yang digunakan. Jangan menimpa seluruh `.env`. Jika origin diubah, jalankan:

```bash
cd ~/aerosense-api && docker compose up -d aerosense-api
```

Di Supabase > Authentication > URL Configuration, pastikan Site URL menggunakan `https://aerosense.me` dan redirect URL autentikasi yang dipakai aplikasi sudah diizinkan. Ini terutama diperlukan untuk tautan konfirmasi akun atau pemulihan password.

## 5. Uji domain publik

```bash
curl --fail https://aerosense.me/api/health
```

Hasil harus JSON `{"status":"ok"}`, bukan HTML. Buka https://aerosense.me/dashboard lalu hard refresh. Uji dari HP dengan data seluler: dashboard, login, Hub Lingkungan, AERO-BOT dan izin mic. Pengunjung tidak memerlukan SSH atau NetBird.

Jika domain masih menampilkan web lama sementara pemeriksaan lokal benar, periksa kembali tunnel dan service URL yang dipakai hostname tersebut. Jika ada cache rule yang meng-cache HTML, purge URL HTML terkait dan hindari cache untuk `/api/*`.

## 6. Pastikan layanan hidup setelah reboot

Untuk connector yang sudah dipasang sebagai service host:

```bash
sudo systemctl enable --now cloudflared
```

Untuk connector Docker yang sudah ada, gunakan nama container sebenarnya:

```bash
docker update --restart unless-stopped NAMA_CONTAINER_CLOUDFLARED
```

Container web pada Compose repositori sudah memiliki `restart: unless-stopped`. Server Ubuntu dan Docker harus tetap menyala. SSH tunnel laptop tidak dibutuhkan untuk akses domain publik.

## Akses guest

Domain publik dan publikasi data node adalah dua hal terpisah. Status `public_nodes: 0` berarti guest belum memiliki node yang dipublikasikan pengelola. Jangan menerbitkan node privat tanpa keputusan pengelola. Akun yang berhak tetap dapat melihat node melalui login.

## Pembaruan berikutnya

Setelah route domain benar, pembaruan desain cukup dilakukan dengan perintah pada langkah pertama. Tidak perlu mengganti domain, tunnel, atau DNS setiap kali ada perubahan.

Referensi: https://developers.cloudflare.com/tunnel/get-started/ dan https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/.

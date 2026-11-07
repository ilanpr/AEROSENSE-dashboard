# Hak akses AEROSENSE

Peran disimpan per lokasi di tabel `ae_members` (`viewer`, `operator`, `auditor`, `admin`). Tamu adalah pengunjung tanpa akun; mereka hanya melihat node yang dipublikasikan (`ae_nodes.public_read = true`). Aturan ditegakkan oleh API, bukan hanya disembunyikan di tampilan.

| Fitur | Tamu | Warga (`viewer`) | Operator | Auditor | Admin |
|---|---|---|---|---|---|
| Beranda, Hub lingkungan, Peta sensor, Monitoring node | ✅ node publik | ✅ | ✅ | ✅ | ✅ |
| Riwayat 24 jam (nilai terkoreksi, ringkasan) | ✅ node publik | ✅ | ✅ | ✅ | ✅ |
| Detail model: input mentah, estimasi GRU | ❌ | ❌ | ✅ | ✅ | ✅ |
| Ekspor JSON riwayat | ❌ | ❌ | ✅ | ✅ | ✅ |
| Tinjau peringatan, ubah ambang, pengaturan robot | ❌ | ❌ | ✅ | ❌ | ✅ |
| Laporan lingkungan (PDF/JSON audit ESG) | ❌ | ❌ | ❌ | ✅ baca | ✅ |
| Tanya AERO-BOT | masuk dulu | ✅ | ✅ | ✅ | ✅ |

Di API: `/v1/history` dan `/v1/public/history` mengembalikan `detail: "simple"` (nilai terkoreksi saja) atau `detail: "model"` (baris lengkap). `/v1/dashboard` mengosongkan `latest.gru` untuk lokasi dengan peran `viewer`. `/v1/access` mengembalikan `role`, `can_audit_esg`, `can_view_model`, dan `can_manage`. Logikanya ada di `server/api/access.mjs`.

## Memberi peran

Di Supabase SQL Editor (ganti email dan lokasi):

```sql
insert into public.ae_members (user_id, location_id, role)
select id, 'ID-LOKASI', 'auditor' from auth.users where email = 'auditor@contoh.co.id'
on conflict (user_id, location_id) do update set role = excluded.role;
```

Peran `auditor` cocok untuk auditor ESG eksternal: dapat membaca laporan dan detail model, tetapi tidak dapat mengubah ambang atau meninjau peringatan.

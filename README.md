# SEO Workspace

Workspace internal tim SEO: kredensial hosting & VPS, domain + tujuan redirect,
akun email + kode 2FA live, dan tracking pembelian backlink.
Rancangan lengkap: [docs/RANCANGAN.md](docs/RANCANGAN.md).

## Menjalankan (Docker)

```bash
./scripts/gen-env.sh          # sekali saja: buat .env dengan secret acak
docker compose up -d --build  # build & jalankan app + PostgreSQL
```

Buka http://localhost:3000 → pertama kali akan diminta **membuat akun admin**.

> ⚠️ **Backup `ENCRYPTION_KEY` dari file `.env`** ke password manager.
> Jika key hilang, semua password/2FA yang tersimpan tidak bisa dibuka lagi.

## Perintah berguna

```bash
docker compose logs -f app                                   # lihat log
docker compose up -d --build                                 # update setelah ubah kode
docker compose down                                          # stop (data tetap aman di volume)
```

## Keamanan login

- **2FA aplikasi**: tiap user mengaktifkan di menu **Akun** (scan QR dengan Google
  Authenticator / Authy / 1Password). Saat aktif, user dapat 10 **recovery code**
  sekali pakai. Simpan di tempat aman.
- **Wajibkan 2FA untuk semua user**: set `REQUIRE_2FA=true` di `.env`, lalu
  `docker compose up -d`. User tanpa 2FA akan diarahkan ke halaman Akun sampai mengaktifkan.
- **Ganti password** otomatis mengeluarkan semua perangkat lain.
- **Admin** (menu Pengguna → ⋯): reset password (password sementara tampil sekali),
  matikan 2FA user yang kehilangan HP, keluarkan user dari semua perangkat.
- Login dibatasi 5 percobaan salah per 15 menit (password maupun kode 2FA).

## Backup & restore

Service `backup` otomatis membuat backup saat stack menyala, lalu tiap
`BACKUP_INTERVAL_HOURS` jam (default 24) ke folder `./backups`, dan menghapus yang
lebih tua dari `BACKUP_KEEP_DAYS` hari (default 14).

```bash
./scripts/backup-now.sh                          # backup manual sekarang
./scripts/restore.sh backups/seo-XXXXXXXX-XXXXXX.dump   # restore (ada konfirmasi + backup pengaman)
docker compose logs backup                       # cek backup berjalan
```

> Backup berisi password yang **terenkripsi**. Untuk membukanya dibutuhkan
> `ENCRYPTION_KEY` yang sama. Simpan `.env` terpisah dari backup, dan salin folder
> `backups/` ke luar server (mis. rclone ke Google Drive/S3) supaya aman jika VPS rusak.

## Struktur

```
prisma/schema.prisma        model database
src/lib/resources.ts        definisi field tiap modul (tambah field/modul di sini)
src/lib/crypto.ts           enkripsi AES-256-GCM
src/lib/auth.ts             sesi, revoke sesi, rate limit, audit
src/lib/mfa.ts              2FA login aplikasi + recovery code
src/app/auth-actions.ts     login, 2FA, password, kelola user
scripts/                    gen-env, backup-loop, backup-now, restore
src/app/actions.ts          simpan / hapus / buka password / kode 2FA / link backlink
src/app/(app)/[resource]/   halaman list, tambah, detail, edit (generik)
src/app/(app)/              dashboard, pengguna, akun, audit log
```

Menambah field baru: tambah kolom di `prisma/schema.prisma`, buat migrasi
(`npx prisma migrate dev --name nama_perubahan` dengan DATABASE_URL lokal),
lalu tambahkan definisinya di `src/lib/resources.ts`.

## Deploy ke VPS

Jangan buka port 3000 langsung ke internet. Port di `docker-compose.yml` sengaja
hanya `127.0.0.1`. Pasang di belakang **Cloudflare Tunnel + Access**, **Tailscale**,
atau reverse proxy HTTPS (Caddy/Nginx), lalu set `COOKIE_SECURE=true` di `.env`.

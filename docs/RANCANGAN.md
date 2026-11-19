# SEO Workspace — Rancangan & Tech Stack

Webapp internal tim SEO untuk menyimpan aset & kredensial (hosting, VPS, domain,
akun email + 2FA) dan mencatat pembelian backlink. Semua jalan di Docker.

## 1. Tech stack

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Satu codebase untuk UI + backend (Server Actions), tidak perlu API terpisah |
| UI | **Tailwind CSS 4** | Cepat, tanpa library komponen berat |
| Database | **PostgreSQL 16** | Stabil, relasional (domain ↔ hosting ↔ backlink) |
| ORM | **Prisma 6** | Schema jelas, migrasi otomatis |
| Auth | Session cookie JWT (`jose`) + `bcryptjs` | Ringan, tanpa layanan luar; cookie httpOnly |
| Enkripsi rahasia | **AES-256-GCM** (Node `crypto`) | Password & secret 2FA disimpan terenkripsi di DB |
| 2FA | `otplib` (TOTP, RFC 6238) | Menampilkan kode 6 digit live dari secret yang disimpan |
| Deploy | **Docker Compose**: `app` + `db` (+ volume) | Satu perintah `docker compose up -d` |

## 2. Modul (fase 1 / MVP)

1. **Dashboard** — ringkasan jumlah aset, domain/hosting/VPS yang akan expired ≤ 30 hari, total backlink per vendor.
2. **Hosting** — provider, URL panel (cPanel/DirectAdmin/dll), username, password 🔒, tanggal expired, catatan.
3. **VPS / Server** — label, provider, IP, port SSH, username, password 🔒, URL panel, expired, catatan.
4. **Domain** — nama domain, registrar, akun registrar, expired, ditaruh di hosting/VPS mana, **redirect ke mana** (URL tujuan + tipe 301/302), status (aktif / redirect / parkir / mati), catatan.
5. **Email & Akun** — email, password 🔒, provider, email pemulihan, **secret 2FA 🔒 → kode TOTP live + hitung mundur**, backup codes 🔒, catatan.
6. **Backlink** — order pembelian: vendor (mis. BandarPBN), jenis (blogpost / PBN / guest post / sosial), **jumlah dibeli** (mis. 100), harga, tanggal beli, domain target, URL target, anchor text, status.
   Tiap order punya daftar **link hasil** (URL live + status live / pending / hilang) → progres `terkirim / dibeli` otomatis.
7. **Pengguna** — admin bisa menambah anggota tim (role ADMIN / MEMBER).
8. **Audit log** — setiap kali password/secret **dibuka atau disalin**, tercatat siapa, kapan, item apa.

🔒 = dienkripsi AES-256-GCM sebelum masuk DB; hanya didekripsi saat user klik "Lihat"/"Salin".

## 2b. Isolasi data per user

- Setiap Hosting, VPS, Domain, Email, dan Order backlink punya **pemilik** (`ownerId`) = user yang membuatnya.
- **MEMBER** hanya bisa melihat, mengubah, membuka password/2FA, dan menghapus **datanya sendiri**.
  Pembatasan ini dicek di server, di setiap query dan setiap aksi, bukan cuma disembunyikan di tampilan.
- Dropdown relasi (domain → hosting/VPS, backlink → domain) hanya berisi data milik pemilik yang sama.
- Nama domain unik **per user**, jadi dua user boleh mencatat domain yang sama.
- **ADMIN** bisa melihat semua data untuk keperluan audit:
  - filter "Semua user / per user" di dashboard dan semua modul, plus kolom *Pemilik*
  - halaman **Pengguna** berisi rekap per user: jumlah hosting/VPS/domain/akun, link backlink dibeli + total belanja, terakhir aktif
  - **Audit log** bisa difilter per user
  - jika admin membuka password milik member, tercatat di audit log
- Saat user dihapus, datanya dipindahkan ke admin yang menghapus, jadi tidak ada data yang hilang.

## 3. Model data (ringkas)

```
User(id, name, email, passwordHash, role)
Hosting(id, provider, panelUrl, username, passwordEnc, expiresAt, notes)
Vps(id, label, provider, ip, sshPort, username, passwordEnc, panelUrl, expiresAt, notes)
Domain(id, name, registrar, registrarAccount, expiresAt, status,
       redirectTo, redirectType, hostingId?, vpsId?, notes)
EmailAccount(id, email, passwordEnc, provider, recoveryEmail,
             totpSecretEnc?, backupCodesEnc?, notes)
BacklinkOrder(id, vendor, type, quantity, price, purchasedAt, domainId?,
              targetUrl, anchorText, status, notes)
BacklinkItem(id, orderId, url, status)
AuditLog(id, userId, action, entity, entityId, createdAt)
```

## 4. Keamanan

- `ENCRYPTION_KEY` (32 byte, base64) di `.env` — **jangan hilang**, tanpa key ini semua password tidak bisa dibuka. Simpan cadangannya di tempat aman terpisah.
- `SESSION_SECRET` untuk tanda tangan cookie login.
- Password login di-hash bcrypt; login dibatasi (rate limit) untuk cegah brute force.
- Semua halaman wajib login (middleware).
- **Jangan buka ke internet tanpa HTTPS.** Rekomendasi: taruh di VPS di balik Cloudflare Tunnel + Cloudflare Access, atau Tailscale, atau reverse proxy (Caddy/Nginx) dengan HTTPS.
- Backup DB: `docker compose exec db pg_dump -U seo seo > backup.sql` (data tetap terenkripsi di dump).

## 5. Roadmap (fase 2+)

- 2FA untuk login aplikasi itu sendiri
- Notifikasi expired (Telegram/email)
- Cek status backlink otomatis (crawl URL, cek link ke target masih ada)
- Cek redirect domain otomatis (ikuti 301/302, bandingkan dengan catatan)
- Import/export CSV
- Tag / project per money site
- Hak akses per item (sembunyikan item tertentu dari MEMBER)

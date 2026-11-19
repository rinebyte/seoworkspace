#!/bin/sh
# Restore database dari file backup.  Pemakaian:  ./scripts/restore.sh backups/seo-20261119-030000.dump
# PERHATIAN: data sekarang akan DIGANTI isi backup. ENCRYPTION_KEY di .env harus sama dengan saat backup dibuat.
set -eu
cd "$(dirname "$0")/.."
FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Pemakaian: $0 backups/<file>.dump"; echo; echo "Backup yang ada:"; ls -1t backups/*.dump 2>/dev/null | head -20; exit 1
fi
printf "Data sekarang akan diganti dengan isi %s. Lanjut? ketik 'ya': " "$FILE"
read -r ans
[ "$ans" = "ya" ] || { echo "Dibatalkan."; exit 1; }

echo "→ Backup pengaman dulu (kondisi sekarang)..."
./scripts/backup-now.sh
echo "→ Hentikan app..."
docker compose stop app
echo "→ Restore..."
docker compose exec -T db pg_restore -U seo -d seo --clean --if-exists --no-owner --single-transaction < "$FILE"
echo "→ Jalankan app lagi..."
docker compose start app
echo "Selesai. Semua user perlu login ulang jika sesi berubah."

#!/bin/sh
# Backup manual sekarang juga → ./backups/seo-manual-<waktu>.dump
set -eu
cd "$(dirname "$0")/.."
NAME="seo-manual-$(date +%Y%m%d-%H%M%S).dump"
docker compose exec -T backup sh -c "umask 077 && pg_dump -Fc -f /backups/$NAME"
echo "Backup tersimpan: backups/$NAME"

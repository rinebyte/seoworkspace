#!/bin/sh
# Dijalankan oleh service "backup" di docker-compose.
# Backup database setiap BACKUP_INTERVAL_HOURS jam (default 24), simpan BACKUP_KEEP_DAYS hari (default 14).
set -eu
umask 077
INTERVAL=$(( ${BACKUP_INTERVAL_HOURS:-24} * 3600 ))
KEEP=${BACKUP_KEEP_DAYS:-14}
mkdir -p /backups

echo "[backup] aktif: tiap ${BACKUP_INTERVAL_HOURS:-24} jam, simpan ${KEEP} hari, folder ./backups"
while true; do
  F="/backups/seo-$(date +%Y%m%d-%H%M%S).dump"
  if pg_dump -Fc -f "$F.tmp"; then
    mv "$F.tmp" "$F"
    echo "[backup] OK $(basename "$F") ($(du -h "$F" | cut -f1))"
  else
    rm -f "$F.tmp"
    echo "[backup] GAGAL — cek koneksi ke database" >&2
  fi
  find /backups -name 'seo-*.dump' -type f -mtime +"$KEEP" -print -delete | sed 's/^/[backup] hapus lama: /'
  sleep "$INTERVAL"
done

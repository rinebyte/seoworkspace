#!/bin/sh
set -e
echo "→ Menjalankan migrasi database..."
prisma migrate deploy --schema ./prisma/schema.prisma
echo "→ Menjalankan SEO Workspace di port ${PORT}"
exec node server.js

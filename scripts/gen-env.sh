#!/bin/sh
# Membuat file .env dengan secret acak (tidak menimpa .env yang sudah ada).
set -e
cd "$(dirname "$0")/.."
if [ -f .env ]; then echo ".env sudah ada, tidak ditimpa."; exit 1; fi
cat > .env <<EOT
POSTGRES_PASSWORD=$(openssl rand -hex 16)
ENCRYPTION_KEY=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -hex 32)
COOKIE_SECURE=false
APP_PORT=3000
EOT
chmod 600 .env
echo ".env dibuat. BACKUP nilai ENCRYPTION_KEY ke tempat aman (password manager)!"

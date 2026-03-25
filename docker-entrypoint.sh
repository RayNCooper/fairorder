#!/bin/sh
set -e

PRISMA="node node_modules/prisma/build/index.js"

echo "⏳ Waiting for database..."
until node -e "
  const net = require('net');
  const s = net.createConnection({
    host: process.env.DB_HOST || 'db',
    port: parseInt(process.env.DB_PORT || '5432', 10)
  });
  s.on('connect', () => { s.destroy(); process.exit(0); });
  s.on('error', () => process.exit(1));
  setTimeout(() => process.exit(1), 2000);
" 2>/dev/null; do
  sleep 1
done
echo "✅ Database is ready"

echo "⏳ Running migrations..."
$PRISMA migrate deploy
echo "✅ Migrations complete"

if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "⏳ Seeding database..."
  ./node_modules/.bin/tsx prisma/seed.ts || echo "⚠️  Seed skipped (may already exist)"
  echo "✅ Seed complete"
fi

echo "🚀 Starting FairOrder..."
exec node server.js

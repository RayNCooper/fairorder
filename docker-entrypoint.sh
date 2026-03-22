#!/bin/sh
set -e

echo "⏳ Waiting for database..."
until pg_isready -h "${DB_HOST:-db}" -p "${DB_PORT:-5432}" -U "${DB_USER:-fairorder}" -q 2>/dev/null; do
  sleep 1
done
echo "✅ Database is ready"

echo "⏳ Running migrations..."
npx prisma migrate deploy
echo "✅ Migrations complete"

if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "⏳ Seeding database..."
  npx prisma db seed || echo "⚠️  Seed skipped (may already exist)"
  echo "✅ Seed complete"
fi

echo "🚀 Starting FairOrder..."
exec node server.js

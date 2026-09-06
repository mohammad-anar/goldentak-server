#!/bin/sh
set -e

echo "⏳ Synchronizing Prisma database schema..."
npx prisma db push --skip-generate --accept-data-loss

echo "🚀 Starting server..."
exec node dist/server.js

#!/bin/sh
set -e

echo "⏳ Synchronizing Prisma database schema..."
npx prisma db push --skip-generate

echo "🚀 Starting server..."
exec node dist/server.js

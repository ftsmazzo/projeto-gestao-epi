#!/bin/sh
set -eu

echo "[gestao-epi-api] Applying Prisma migrations..."
npx prisma migrate deploy

echo "[gestao-epi-api] Starting NestJS..."
exec node dist/main.js

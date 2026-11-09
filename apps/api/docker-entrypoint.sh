#!/bin/sh
set -eu

echo "[gestao-epi-api] Applying Prisma migrations..."
npx prisma migrate deploy

if [ "${BOOTSTRAP_EPICAT_BRAND:-0}" = "1" ]; then
  echo "[gestao-epi-api] Applying EPICAT brand bootstrap..."
  node dist/scripts/apply-epicat-brand.js || echo "[gestao-epi-api] EPICAT brand bootstrap falhou (seguindo)."
fi

if [ "${BOOTSTRAP_EPICAT_WIPE:-0}" = "1" ]; then
  echo "[gestao-epi-api] Wiping EPICAT operational test data..."
  node dist/scripts/wipe-epicat-ops.js || echo "[gestao-epi-api] EPICAT wipe falhou (seguindo)."
fi

echo "[gestao-epi-api] Starting NestJS..."
exec node dist/main.js

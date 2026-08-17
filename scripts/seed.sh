#!/usr/bin/env sh
# ─────────────────────────────────────────────────────────────────────────────
# scripts/seed.sh — Load demo data into the database
# ─────────────────────────────────────────────────────────────────────────────
#
# Creates: super admin, 4 demo brands, store admins, products, B2B buyers.
# Safe to run on an empty database. Skips records that already exist.
#
# Usage (Docker Compose):
#   docker compose --profile tools run --rm seed
#
# Usage (host, requires pnpm + Node 24):
#   DATABASE_URL=postgres://user:pass@host:5432/db \
#   SESSION_SECRET=any-secret \
#   sh scripts/seed.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

# Load .env if present and DATABASE_URL is not already set
if [ -z "$DATABASE_URL" ] && [ -f ".env" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set."
  exit 1
fi

# Build seed script if dist/seed.mjs does not exist yet
SEED_OUT="artifacts/api-server/dist/seed.mjs"
if [ ! -f "$SEED_OUT" ]; then
  echo "▶ Building seed script..."
  cd artifacts/api-server
  node -e "
const { build } = await import('esbuild');
await build({
  entryPoints: ['src/seed.ts'],
  platform: 'node',
  bundle: true,
  format: 'esm',
  outfile: 'dist/seed.mjs',
  external: ['@google-cloud/*', 'pg-native', '*.node'],
  banner: { js: \`import { createRequire as __cr } from 'node:module'; globalThis.require = __cr(import.meta.url);\` },
});
" --input-type=module
  cd -
fi

echo "▶ Seeding database..."
node --enable-source-maps "$SEED_OUT"

#!/usr/bin/env sh
# ─────────────────────────────────────────────────────────────────────────────
# scripts/migrate.sh — Push the Drizzle schema to the database
# ─────────────────────────────────────────────────────────────────────────────
#
# Usage (Docker Compose):
#   docker compose --profile tools run --rm migrate
#
# Usage (host, requires pnpm + Node 24):
#   DATABASE_URL=postgres://user:pass@host:5432/db sh scripts/migrate.sh
#
# The script reads DATABASE_URL from the environment or from .env in the
# current directory.
# ─────────────────────────────────────────────────────────────────────────────

set -e

# Load .env if present and DATABASE_URL is not already set
if [ -z "$DATABASE_URL" ] && [ -f ".env" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "  Either set it in the environment or create a .env file from .env.example."
  exit 1
fi

echo "▶ Running schema push against: $(echo "$DATABASE_URL" | sed 's/:\/\/[^@]*@/:\\/\\/*****@/')"
pnpm --filter @workspace/db run push
echo "✓ Schema push complete."

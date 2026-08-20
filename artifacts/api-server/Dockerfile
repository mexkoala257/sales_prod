# syntax=docker/dockerfile:1
# Build context: workspace root (.)
#
# Stages:
#   builder  — installs deps, compiles API bundle + one-time setup tools, runs pnpm deploy
#   migrate  — has pnpm + source for running drizzle-kit push (one-shot)
#   runtime  — slim production image with only dist/ and flat node_modules

# ── Builder ────────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

# Copy workspace manifests first (better layer caching for deps)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/db/package.json               lib/db/
COPY lib/api-zod/package.json          lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-spec/package.json         lib/api-spec/
COPY artifacts/api-server/package.json artifacts/api-server/

# Install all workspace dependencies from the frozen lockfile
RUN pnpm install --frozen-lockfile

# Copy source — tsconfig.base.json extends from all workspace packages
COPY tsconfig.base.json ./
COPY lib/               lib/
COPY artifacts/api-server/ artifacts/api-server/

# Build the main API bundle and optional one-time tools
RUN cd artifacts/api-server && node build.mjs
RUN cd artifacts/api-server && node build-seed.mjs
RUN cd artifacts/api-server && node build-bootstrap-admin.mjs

# Create a self-contained production deployment with flat (non-symlinked) node_modules.
# --legacy bypasses pnpm 10's ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE requirement.
# The legacy implementation copies all package files (including dist/) into /api-deploy,
# then installs production dependencies into /api-deploy/node_modules without symlinks.
RUN pnpm --filter @workspace/api-server deploy --legacy --prod /api-deploy

# ── Migration runner ───────────────────────────────────────────────────────
# Tracked SQL migration runner — run on every deploy before starting the API.
#   docker compose --profile tools run --rm migrate
#
# Safe to re-run: already-applied files are skipped via the _migrations table.
FROM node:24-alpine AS migrate
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/db/package.json               lib/db/

RUN pnpm install --frozen-lockfile --filter @workspace/db

# Copy the migration runner and SQL files
COPY lib/db/migrate.mjs   lib/db/
COPY lib/db/migrations/   lib/db/migrations/

CMD ["pnpm", "--filter", "@workspace/db", "run", "migrate"]

# ── Runtime ────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
WORKDIR /app

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# node_modules from pnpm deploy — flat layout, no symlinks, production deps only.
# @google-cloud/storage and all other external packages are included here.
COPY --from=builder /api-deploy/node_modules ./node_modules

# Built bundle (dist/ is in .gitignore so pnpm deploy skips it — copy separately)
COPY --from=builder /workspace/artifacts/api-server/dist ./dist

RUN chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "--enable-source-maps", "dist/index.mjs"]

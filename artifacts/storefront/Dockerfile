# syntax=docker/dockerfile:1
# Build context: workspace root (.)
#
# NOTE: Builder uses node:24-slim (Debian/glibc) rather than Alpine.
# The pnpm workspace intentionally excludes @rollup/rollup-linux-x64-musl
# (the Alpine/musl native binding), so Vite cannot bundle on Alpine.
# The final nginx image is Alpine-based (no Node required at runtime).

# ── Builder ────────────────────────────────────────────────────────────────
FROM node:24-slim AS builder
WORKDIR /workspace

# VITE_PLATFORM_HOST is baked into the SPA bundle at build time so the browser
# can identify the platform's own hostname and not mistake it for a custom brand
# domain.  Pass it via --build-arg or the compose `args` section.
# Example: docker build --build-arg VITE_PLATFORM_HOST=platform.example.com .
ARG VITE_PLATFORM_HOST

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

# Copy workspace manifests first (better layer caching for deps)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/db/package.json               lib/db/
COPY lib/api-zod/package.json          lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-spec/package.json         lib/api-spec/
COPY artifacts/storefront/package.json artifacts/storefront/

# Install all workspace dependencies from the frozen lockfile
RUN pnpm install --frozen-lockfile

# Copy source — tsconfig.base.json is extended by all workspace tsconfig files
COPY tsconfig.base.json ./
COPY lib/               lib/
COPY artifacts/storefront/ artifacts/storefront/

# Build the Vite SPA
# BASE_PATH=/ serves at root; PORT is required by vite.config.ts at parse time.
# VITE_PLATFORM_HOST is forwarded from the build ARG so it is inlined into the bundle.
RUN cd artifacts/storefront && \
    BASE_PATH=/ PORT=3000 NODE_ENV=production \
    VITE_PLATFORM_HOST=${VITE_PLATFORM_HOST} \
    pnpm build

# ── Runtime ────────────────────────────────────────────────────────────────
FROM nginx:alpine AS runtime

# Custom Nginx config: SPA fallback + /api proxy to the api container
COPY artifacts/storefront/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built SPA assets
COPY --from=builder /workspace/artifacts/storefront/dist/public /usr/share/nginx/html

EXPOSE 80

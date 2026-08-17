---
name: Multi-Brand Platform Architecture
description: Key decisions, credentials, and quirks for the multi-brand e-commerce + B2B wholesale platform built in this monorepo
---

# Multi-Brand Platform — Architecture Notes

## Auth
- Custom JWT via `jsonwebtoken` + `bcryptjs` — no Clerk, no Replit Auth
- Three roles: `super_admin`, `store_admin`, `b2b_client`
- JWT secret: `SESSION_SECRET` env var
- Middleware in `artifacts/api-server/src/middlewares/auth.ts`
- Frontend stores token in localStorage (`auth_token`, `auth_user`)
- `customFetch` in `lib/api-client-react/src/custom-fetch.ts` reads token and attaches Bearer header

## Database
- Drizzle ORM + PostgreSQL
- Schema files: `lib/db/src/schema/` — stores, users, b2b_clients, products (+ variants + images + join tables), categories, artwork, orders (+ order_items)
- Push: `pnpm --filter @workspace/db run push`

## API Server
- Routes split by domain: auth.ts, super-admin.ts, admin.ts, b2b.ts, storefront.ts, storage.ts
- Object storage (GCS) for artwork uploads via presigned URL flow
- Seed script: build with esbuild (see below), then `node dist/seed.mjs`
- Seed credentials: admin@platform.com/admin1234, apex-admin@example.com/store1234, buyer@sportsgear-wholesale.com/buyer1234

**Why:** Cannot use `zod` or `zod/v4` directly in `storage.ts` — neither resolves in esbuild bundle. Use manual JS validation instead.

## Object Storage
- Already provisioned (`DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` set)
- Artwork upload: client → POST /api/storage/uploads/request-url → PUT presigned URL → POST /api/b2b/artwork

## Seed script
To rebuild and run seed:
```bash
cd artifacts/api-server
node -e "const { build } = await import('esbuild'); await build({ entryPoints: ['src/seed.ts'], platform: 'node', bundle: true, format: 'esm', outfile: 'dist/seed.mjs', external: ['@google-cloud/*', 'pg-native', '*.node'], banner: { js: \`import { createRequire as __cr } from 'node:module'; globalThis.require = __cr(import.meta.url);\` } }); console.log('built');" --input-type=module
node dist/seed.mjs
```

## Frontend
- All pages built by design subagent in `artifacts/storefront/src/pages/`
- UI barrel: `artifacts/storefront/src/components/ui/index.tsx` — re-exports Select from select.tsx
- Generated enum types (StoreInputFontFamily, ProductInputStatus, WholesaleOrderInputPaymentTerms etc.) are in `lib/api-client-react/src/generated/api.schemas.ts` and re-exported from the package index
- `customFetch` exported from `lib/api-client-react/src/index.ts`

**Why:** Design subagent imports enum-like constants from `@workspace/api-client-react` — they all exist in the generated schemas, not as custom types.

---
name: Vite API Proxy
description: The storefront vite.config.ts must proxy /api to localhost:8080 or browser calls fail
---

# Vite API Proxy — Required

The storefront and API server run on different ports. Without a proxy, browser fetch calls to `/api/*` hit the wrong port and fail silently.

**Rule:** Always ensure `artifacts/storefront/vite.config.ts` has this proxy block inside `server`:

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:8080',
    changeOrigin: true,
  },
},
```

**Why:** Replit's preview is an iframe proxy. All API calls must be relative paths (not hardcoded hostnames). The vite dev server proxy bridges the frontend port to the API port so relative `/api/*` paths work.

**How to apply:** Any time the storefront vite.config.ts is regenerated or reset, re-add this proxy block.

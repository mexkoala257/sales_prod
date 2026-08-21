---
name: Traefik + Nginx proxy header forwarding
description: X-Forwarded-Proto must be passed through from Traefik, not set from $scheme, or HTTPS callbacks become http://.
---

# Traefik + Nginx X-Forwarded-Proto

## The rule
In `artifacts/storefront/nginx.conf`, the `/api/` proxy block must use:

```nginx
proxy_set_header   X-Forwarded-Proto $http_x_forwarded_proto;
proxy_set_header   X-Forwarded-Host  $http_x_forwarded_host;
```

**Never** use `proxy_set_header X-Forwarded-Proto $scheme;` when Nginx sits behind Traefik.

**Why:** Traefik terminates TLS and forwards plain HTTP to the Nginx web container. Nginx's `$scheme` is therefore always `"http"`. When the API builds absolute callback URLs (e.g. Shopify OAuth redirect_uri) from `req.get("x-forwarded-proto")`, it gets `"http"` and constructs `http://...` URLs. Shopify, and any other OAuth provider, rejects these because the allowlist only contains `https://` entries.

**How to apply:** Any time the storefront's nginx.conf proxy block is modified or regenerated, verify these two headers use `$http_x_forwarded_*` variables, not `$scheme` / `$host`.

**VPS hotfix (before rebuild):**
```bash
sed -i \
  's|proxy_set_header   X-Forwarded-Proto \$scheme;|proxy_set_header   X-Forwarded-Proto \$http_x_forwarded_proto;\n        proxy_set_header   X-Forwarded-Host  \$http_x_forwarded_host;|' \
  /root/platform/artifacts/storefront/nginx.conf
docker compose build web && docker compose up -d --force-recreate web
```

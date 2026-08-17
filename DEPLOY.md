# Deployment Guide

Self-hosted deployment for the Multi-Brand Shopify E-Commerce & B2B Wholesale Platform on any Linux VPS using Docker Compose.

## Prerequisites

| Requirement | Minimum | Notes |
|---|---|---|
| Docker Engine | 24+ | [Install guide](https://docs.docker.com/engine/install/) |
| Docker Compose | v2.20+ | Included with Docker Desktop; install as plugin on servers |
| RAM | 1 GB | 2 GB recommended for comfortable headroom |
| Open ports | 80 (or custom) | Configure `WEB_PORT` if 80 is taken |
| Domain name | optional | Required for HTTPS |

---

## Quick Start

### 1. Get the code

```bash
git clone <your-repo-url> platform
cd platform
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the two required values:

```
POSTGRES_PASSWORD=<strong-random-password>
SESSION_SECRET=<strong-random-secret>
```

Generate secure values:
```bash
openssl rand -base64 32   # use for POSTGRES_PASSWORD
openssl rand -base64 48   # use for SESSION_SECRET
```

### 3. Build images and start services

```bash
docker compose up -d --build
```

First build takes 3–5 minutes (downloads base images, installs pnpm deps, compiles bundles).
Subsequent builds are much faster thanks to Docker layer caching.

Three containers start:
| Container | Role |
|---|---|
| `postgres` | PostgreSQL 17 database with a named volume for persistence |
| `api` | Node.js 24 API server on internal port 8080 |
| `web` | Nginx serving the React SPA and proxying `/api` to the API server |

### 4. Push the database schema

Run once after the first deploy, and again whenever the schema changes:

```bash
docker compose --profile tools run --rm migrate
```

### 5. (Optional) Load demo data

Creates 4 demo brands, products, and sample accounts — safe to skip for a clean production install:

```bash
docker compose --profile tools run --rm seed
```

**Demo credentials after seeding:**
| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@platform.com` | `admin1234` |
| Store Admin (Apex) | `apex-admin@example.com` | `store1234` |
| B2B Buyer | `buyer@sportsgear-wholesale.com` | `buyer1234` |

> ⚠️ Change all demo passwords immediately after seeding.

### 6. Verify

```bash
curl http://localhost/api/healthz
# → {"status":"ok"}
```

Open `http://your-server-ip` — you should see the Platform Storefronts landing page with all four brands.

---

## Updating

```bash
git pull
docker compose build
docker compose up -d
# If lib/db/src/schema/ changed:
docker compose --profile tools run --rm migrate
```

---

## HTTPS / SSL

The platform does not manage TLS itself. The recommended approach is a host Nginx reverse proxy + Certbot.

**Step 1** — Change `WEB_PORT` in `.env` so the container no longer binds to 80:
```
WEB_PORT=8081
```
Then restart: `docker compose up -d`

**Step 2** — Install Nginx and Certbot on the host:
```bash
apt install nginx certbot python3-certbot-nginx
```

**Step 3** — Add a host Nginx site:
```nginx
server {
    server_name yourdomain.com;
    location / {
        proxy_pass         http://127.0.0.1:8081;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-Proto https;
    }
}
```

**Step 4** — Obtain a certificate:
```bash
certbot --nginx -d yourdomain.com
```

Full guide: https://certbot.eff.org/instructions

---

## Feature Availability on VPS

| Feature | Available | Notes |
|---|---|---|
| All portals (super admin, store admin, B2B, storefront) | ✅ | Full functionality |
| Products, orders, categories, B2B accounts | ✅ | Full functionality |
| Store branding & Shopify demo mode | ✅ | Full functionality |
| B2B artwork uploads | ❌ | Requires Replit runtime |

**Why artwork uploads don't work on VPS:** The object storage implementation authenticates via Replit's local sidecar service (`http://127.0.0.1:1106`), which only exists inside the Replit environment. Artwork upload endpoints will return an error on self-hosted deployments; all other features work normally. Standard S3/GCS support is tracked as a future improvement.

---

## Useful Commands

```bash
# Follow live logs from all services
docker compose logs -f

# Follow API logs only
docker compose logs -f api

# Restart a single service after a code change
docker compose build api && docker compose up -d api

# Open a shell in the API container
docker compose exec api sh

# Stop all services (data is preserved in the postgres volume)
docker compose down

# Stop all services AND delete all data
docker compose down -v
```

---

## Troubleshooting

### "POSTGRES_PASSWORD is required" error on startup
Set `POSTGRES_PASSWORD` in your `.env` file. It has no default value for security reasons.

### API container exits immediately
Check logs: `docker compose logs api`. Common causes:
- `SESSION_SECRET` not set in `.env`
- Postgres container not yet healthy (wait 10–15 s and retry)

### Port 80 already in use
Set `WEB_PORT=8081` (or any free port) in `.env`, then `docker compose up -d`.

### Schema out of date after an update
Run `docker compose --profile tools run --rm migrate` to push the latest schema.

### Postgres password changed after initial setup
The postgres image only sets credentials on volume creation. If you change `POSTGRES_PASSWORD` after the volume exists, you must reset:
```bash
docker compose down -v   # ⚠️ deletes all data
docker compose up -d
docker compose --profile tools run --rm migrate
```

### Build fails: "Cannot find package"
Ensure you are running `docker compose build` from the repo root, not from a subdirectory. The build context must be the workspace root.

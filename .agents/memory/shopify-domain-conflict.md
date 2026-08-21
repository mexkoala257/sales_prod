---
name: Shopify custom domain conflict with platform domain
description: If the platform domain is also set as Shopify's custom domain, checkout URLs point back to the platform, causing React Router 404s.
---

# Shopify Domain Conflict on Checkout

## The rule
The platform domain (e.g. `doodleworkssf.com`) must **never** be set as a custom domain inside Shopify Admin → Online Store → Domains.

**Why:** When Shopify has a custom domain configured, it bakes that domain into every URL it generates, including the `checkoutUrl` returned by the `cartCreate` Storefront API mutation. If that domain is the platform domain, the checkout URL (e.g. `https://doodleworkssf.com/cart/c/...`) resolves to Nginx, which serves the React SPA. React Router has no route for `/cart/c/*`, so it renders its 404 page — making checkout appear broken even though the API is returning 200.

**How to apply:** During VPS onboarding or Shopify connection setup, confirm Shopify's primary domain is its native `.myshopify.com` domain. Shopify should use `.myshopify.com` for checkout; the platform domain is used only by the platform's branded storefront.

**Symptom:** Checkout POST returns 200 with a `checkoutUrl`, but the browser shows a React 404. The URL in the address bar starts with the platform domain (`https://doodleworkssf.com/cart/c/...`) instead of a `.myshopify.com` URL.

**Fix:** Shopify Admin → Online Store → Domains → remove the platform domain as Shopify's primary domain.

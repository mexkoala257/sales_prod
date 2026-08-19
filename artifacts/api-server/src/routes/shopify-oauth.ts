/**
 * Shopify OAuth 2.0 installation flow.
 *
 * Shopify no longer supports creating new custom apps with static tokens,
 * so new installs must go through their OAuth handshake.
 *
 * Flow:
 *   1. Super-admin saves Store URL + Client ID + Client Secret in Settings.
 *   2. Clicks "Connect Shopify" → GET /super-admin/shopify/oauth/start
 *      Server generates a nonce, stores it, redirects browser to Shopify.
 *   3. Merchant approves scopes on Shopify's page.
 *   4. Shopify redirects to GET /shopify/oauth/callback?code=...&shop=...&hmac=...&state=...
 *      Server verifies HMAC + state, exchanges code for admin token,
 *      auto-creates a Storefront API token, persists everything.
 *   5. Browser is redirected back to /super-admin/settings?shopify=connected.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { getSetting, upsertSettings } from "../lib/settings";
import { requireSuperAdmin } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SCOPES = [
  "read_products",
  "read_product_listings",
  "read_collections",
  "write_draft_orders",
  "read_draft_orders",
  "read_orders",
].join(",");

function normalizeShop(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
}

function callbackUrl(req: Request): string {
  const proto = (req.get("x-forwarded-proto") ?? req.protocol) as string;
  const host = (req.get("x-forwarded-host") ?? req.get("host")) as string;
  return `${proto}://${host}/api/shopify/oauth/callback`;
}

/**
 * Verifies Shopify's HMAC query-param signature on the OAuth callback.
 * https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant#verification
 */
function verifyCallbackHmac(query: Record<string, string>, clientSecret: string): boolean {
  const { hmac, ...rest } = query;
  if (!hmac) return false;
  const message = Object.entries(rest)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const digest = createHmac("sha256", clientSecret).update(message).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(hmac, "hex"));
  } catch {
    return false;
  }
}

// ── Step 1: Initiate OAuth ────────────────────────────────────────────────────

router.get("/super-admin/shopify/oauth/start", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const [storeUrl, clientId] = await Promise.all([
    getSetting("shopifyStoreUrl"),
    getSetting("shopifyClientId"),
  ]);

  if (!storeUrl || !clientId) {
    res.status(400).json({ error: "Set 'Store URL' and 'Client ID' in Settings → Shopify before connecting." });
    return;
  }

  const shop = normalizeShop(storeUrl);
  const state = randomBytes(16).toString("hex");
  await upsertSettings([{ key: "shopifyOAuthState", value: state }]);

  const redirectUri = callbackUrl(req);
  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  logger.info({ shop, redirectUri }, "Shopify OAuth: starting authorization flow");
  // Return the URL as JSON so the frontend can navigate with its auth header
  // (direct browser navigation can't attach the JWT).
  res.json({ url: authUrl.toString() });
});

// ── Step 2: OAuth callback ────────────────────────────────────────────────────

router.get("/shopify/oauth/callback", async (req: Request, res: Response): Promise<void> => {
  const q = req.query as Record<string, string>;
  const { code, shop, state, hmac } = q;

  const frontendBase = "/super-admin/settings";

  if (!code || !shop || !state || !hmac) {
    res.redirect(`${frontendBase}?shopify=error&reason=missing_params`);
    return;
  }

  // CSRF: state must match the nonce we generated
  const savedState = await getSetting("shopifyOAuthState");
  if (!savedState || state !== savedState) {
    logger.warn({ state, savedState }, "Shopify OAuth callback: state mismatch — possible CSRF");
    res.redirect(`${frontendBase}?shopify=error&reason=state_mismatch`);
    return;
  }

  const clientSecret = await getSetting("shopifyClientSecret");
  if (!clientSecret) {
    res.redirect(`${frontendBase}?shopify=error&reason=no_secret`);
    return;
  }

  if (!verifyCallbackHmac(q, clientSecret)) {
    logger.warn({ shop }, "Shopify OAuth callback: HMAC verification failed");
    res.redirect(`${frontendBase}?shopify=error&reason=hmac_invalid`);
    return;
  }

  try {
    const clientId = await getSetting("shopifyClientId");

    // Exchange authorization code for a permanent admin access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      throw new Error(`Token exchange failed (${tokenRes.status}): ${body.slice(0, 200)}`);
    }
    const { access_token: adminToken } = (await tokenRes.json()) as { access_token: string };

    // Auto-create (or reuse) a Storefront API access token
    let storefrontToken = "";
    try {
      const sfCreateRes = await fetch(`https://${shop}/admin/api/2024-01/storefront_access_tokens.json`, {
        method: "POST",
        headers: { "X-Shopify-Access-Token": adminToken, "Content-Type": "application/json" },
        body: JSON.stringify({ storefront_access_token: { title: "Platform Storefront Token" } }),
      });
      if (sfCreateRes.ok) {
        const sfData = (await sfCreateRes.json()) as { storefront_access_token: { access_token: string } };
        storefrontToken = sfData.storefront_access_token.access_token;
      } else {
        // Likely already exists — fetch the list and reuse the matching one
        const sfListRes = await fetch(`https://${shop}/admin/api/2024-01/storefront_access_tokens.json`, {
          headers: { "X-Shopify-Access-Token": adminToken },
        });
        if (sfListRes.ok) {
          const listData = (await sfListRes.json()) as {
            storefront_access_tokens: Array<{ title: string; access_token: string }>;
          };
          const existing = listData.storefront_access_tokens.find((t) => t.title === "Platform Storefront Token");
          if (existing) storefrontToken = existing.access_token;
        }
      }
    } catch (sfErr) {
      logger.warn({ sfErr }, "Shopify OAuth: could not auto-create Storefront API token; can be set manually in Settings");
    }

    // Persist tokens; invalidate one-time nonce
    const toSave = [
      { key: "shopifyStoreUrl", value: shop },
      { key: "shopifyAdminToken", value: adminToken },
      { key: "shopifyConnectedAt", value: new Date().toISOString() },
      { key: "shopifyOAuthState", value: "" },
    ];
    if (storefrontToken) toSave.push({ key: "shopifyStorefrontToken", value: storefrontToken });
    await upsertSettings(toSave);

    logger.info({ shop, hasStorefrontToken: !!storefrontToken }, "Shopify OAuth: store connected successfully");
    res.redirect(`${frontendBase}?shopify=connected`);
  } catch (err) {
    logger.error({ err }, "Shopify OAuth: failed to complete installation");
    res.redirect(`${frontendBase}?shopify=error&reason=token_exchange`);
  }
});

// ── OAuth status ──────────────────────────────────────────────────────────────

router.get("/super-admin/shopify/oauth/status", requireSuperAdmin, async (_req: Request, res: Response): Promise<void> => {
  const [connectedAt, storeUrl, hasToken, hasStorefrontToken, hasClientId] = await Promise.all([
    getSetting("shopifyConnectedAt"),
    getSetting("shopifyStoreUrl"),
    getSetting("shopifyAdminToken").then((t) => !!t),
    getSetting("shopifyStorefrontToken").then((t) => !!t),
    getSetting("shopifyClientId").then((t) => !!t),
  ]);
  res.json({
    connected: !!connectedAt && hasToken,
    connectedAt: connectedAt ?? null,
    storeUrl: storeUrl ?? null,
    hasStorefrontToken,
    hasClientId,
  });
});

// ── Disconnect ────────────────────────────────────────────────────────────────

router.delete("/super-admin/shopify/oauth/disconnect", requireSuperAdmin, async (_req: Request, res: Response): Promise<void> => {
  await upsertSettings([
    { key: "shopifyAdminToken", value: "" },
    { key: "shopifyStorefrontToken", value: "" },
    { key: "shopifyConnectedAt", value: "" },
    { key: "shopifyOAuthState", value: "" },
  ]);
  logger.info("Shopify OAuth: store disconnected");
  res.json({ disconnected: true });
});

export default router;

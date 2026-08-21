import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { storesTable, productsTable, productVariantsTable, shopifyCollectionStoreMappingsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireSuperAdmin } from "../middlewares/auth";
import { getSetting } from "../lib/settings";
import {
  listShopifyCollections,
  syncShopifyCatalog,
  createShopifyCheckout,
  verifyShopifyWebhookHmac,
  recordShopifyOrder,
} from "../lib/shopify";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── Super Admin: collections + mappings ───────────────────────────────────

router.get("/super-admin/shopify/collections", requireSuperAdmin, async (_req, res): Promise<void> => {
  try {
    const collections = await listShopifyCollections();
    res.json(collections);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: message });
  }
});

router.put("/super-admin/shopify/mappings", requireSuperAdmin, async (req, res): Promise<void> => {
  const body = req.body as { mappings?: Array<{ collectionId?: unknown; storeIds?: unknown }> };
  if (!Array.isArray(body?.mappings)) {
    res.status(400).json({ error: "Body must have a 'mappings' array" });
    return;
  }

  const mappings = body.mappings
    .map((m) => ({
      collectionId: String(m.collectionId ?? ""),
      storeIds: Array.isArray(m.storeIds) ? m.storeIds.map((s) => parseInt(String(s), 10)).filter((n) => !Number.isNaN(n)) : [],
    }))
    .filter((m) => m.collectionId.length > 0);

  // Validate store ids exist
  const allStoreIds = [...new Set(mappings.flatMap((m) => m.storeIds))];
  if (allStoreIds.length > 0) {
    const stores = await db.select({ id: storesTable.id }).from(storesTable).where(inArray(storesTable.id, allStoreIds));
    const valid = new Set(stores.map((s) => s.id));
    const invalid = allStoreIds.filter((id) => !valid.has(id));
    if (invalid.length > 0) {
      res.status(400).json({ error: `Unknown store ids: ${invalid.join(", ")}` });
      return;
    }
  }

  // Replace mappings for the submitted collections only
  for (const m of mappings) {
    await db.delete(shopifyCollectionStoreMappingsTable).where(eq(shopifyCollectionStoreMappingsTable.collectionId, m.collectionId));
    if (m.storeIds.length > 0) {
      await db.insert(shopifyCollectionStoreMappingsTable).values(m.storeIds.map((storeId) => ({ collectionId: m.collectionId, storeId })));
    }
  }

  const rows = await db.select().from(shopifyCollectionStoreMappingsTable);
  res.json(rows.map((r) => ({ collectionId: r.collectionId, storeId: r.storeId })));
});

// ── Super Admin: sync trigger + status ────────────────────────────────────

router.post("/super-admin/shopify/sync", requireSuperAdmin, async (_req, res): Promise<void> => {
  const summary = await syncShopifyCatalog();
  res.json(summary);
});

router.get("/super-admin/shopify/status", requireSuperAdmin, async (_req, res): Promise<void> => {
  const [lastSyncAt, lastSyncSummary, intervalMinutes] = await Promise.all([
    getSetting("shopifyLastSyncAt"),
    getSetting("shopifyLastSyncSummary"),
    getSetting("shopifySyncIntervalMinutes", "60"),
  ]);
  res.json({
    lastSyncAt: lastSyncAt ?? null,
    lastSyncSummary: lastSyncSummary ?? null,
    syncIntervalMinutes: parseInt(intervalMinutes ?? "60", 10) || 60,
  });
});

// ── B2C: Shopify hosted checkout ──────────────────────────────────────────

router.post("/storefront/:storeSlug/shopify-checkout", async (req, res): Promise<void> => {
  // Same B2C feature guard as the per-store storefront routes: the hosted
  // checkout must respect the operational disable switch.
  const b2cEnabled = await getSetting("featureB2CStorefront", "true");
  if (b2cEnabled === "false") {
    res.status(503).json({ error: "B2C Storefront is currently disabled." });
    return;
  }

  const storeSlug = String(req.params.storeSlug);
  const [store] = await db.select().from(storesTable).where(eq(storesTable.slug, storeSlug));
  if (!store || !store.isActive) { res.status(404).json({ error: "Storefront not found" }); return; }

  const body = req.body as { items?: Array<{ productId?: unknown; variantId?: unknown; quantity?: unknown }> };
  if (!Array.isArray(body?.items) || body.items.length === 0) {
    res.status(400).json({ error: "Body must have a non-empty 'items' array" });
    return;
  }

  // Resolve platform variant ids -> shopify variant ids
  const lineItems: Array<{ shopifyVariantId: string; quantity: number }> = [];
  for (const item of body.items) {
    const quantity = Math.max(1, parseInt(String(item.quantity ?? 1), 10) || 1);
    const variantId = parseInt(String(item.variantId ?? ""), 10);
    const productId = parseInt(String(item.productId ?? ""), 10);

    let shopifyVariantId: string | null = null;
    if (!Number.isNaN(variantId)) {
      const [v] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, variantId));
      if (v) {
        // Ensure the variant belongs to a currently ACTIVE product of this
        // store — disabled (unmapped/removed) products are not sellable.
        const [p] = await db.select({ storeId: productsTable.storeId }).from(productsTable)
          .where(and(eq(productsTable.id, v.productId), eq(productsTable.status, "active")));
        if (p?.storeId === store.id) shopifyVariantId = v.shopifyVariantId;
      }
    } else if (!Number.isNaN(productId)) {
      // No variant selected — use the product's first synced variant
      const [p] = await db.select().from(productsTable)
        .where(and(eq(productsTable.id, productId), eq(productsTable.storeId, store.id), eq(productsTable.status, "active")));
      if (p) {
        const variants = await db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, p.id));
        shopifyVariantId = variants.find((v) => v.shopifyVariantId)?.shopifyVariantId ?? null;
      }
    }

    if (!shopifyVariantId) {
      res.status(400).json({ error: "One or more items are not synced with Shopify and cannot be checked out." });
      return;
    }
    lineItems.push({ shopifyVariantId, quantity });
  }

  // Build the "Return to store" URL: prefer the store's custom domain, fall
  // back to the request origin so the link always goes back to the branded
  // storefront rather than the raw .myshopify.com URL.
  const returnUrl = store.customDomain
    ? `https://${store.customDomain}`
    : `${req.headers["x-forwarded-proto"] ?? "https"}://${req.headers["x-forwarded-host"] ?? req.headers.host}`;

  try {
    const checkoutUrl = await createShopifyCheckout(lineItems, store.id, returnUrl);
    res.json({ checkoutUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, storeSlug }, "Shopify checkout creation failed");
    res.status(502).json({ error: message });
  }
});

// ── Webhook: orders/create ────────────────────────────────────────────────
// Mounted with express.raw() in app.ts so req.body is a Buffer for HMAC.

router.post("/webhooks/shopify/orders-create", async (req, res): Promise<void> => {
  const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
  const hmac = req.get("X-Shopify-Hmac-Sha256");

  const valid = await verifyShopifyWebhookHmac(rawBody, hmac ?? undefined);
  if (!valid) {
    logger.warn("Rejected Shopify webhook: invalid HMAC signature");
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  // Malformed JSON is permanently bad — acknowledge so Shopify doesn't retry forever.
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    logger.warn("Shopify webhook body is not valid JSON; acknowledging without processing");
    res.status(200).json({ received: true, error: "invalid JSON (logged)" });
    return;
  }

  try {
    const orderId = await recordShopifyOrder(payload as Parameters<typeof recordShopifyOrder>[0]);
    res.json({ received: true, orderId });
  } catch (err) {
    // Transient failure (DB, network): 500 so Shopify retries the delivery.
    logger.error({ err }, "Failed to record Shopify orders/create webhook; returning 500 for retry");
    res.status(500).json({ error: "processing failed" });
  }
});

export default router;

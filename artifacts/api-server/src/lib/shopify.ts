/**
 * Shopify integration service.
 *
 * - Catalog sync: pulls products/collections from the Shopify Admin REST API
 *   and upserts them into the platform DB, assigning products to stores via
 *   collection→store mappings.
 * - B2C checkout: creates a Shopify Storefront API cart and returns the hosted
 *   checkout URL.
 * - B2B order push: creates a Shopify draft order for fulfillment tracking.
 * - Webhook HMAC verification for orders/create.
 *
 * All credentials come from platform settings (Super Admin → Settings → Shopify).
 * Shopify failures are logged and never block local operations.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@workspace/db";
import {
  productsTable,
  productVariantsTable,
  productImagesTable,
  shopifyCollectionStoreMappingsTable,
  ordersTable,
  orderItemsTable,
  b2bClientsTable,
  storesTable,
} from "@workspace/db";
import { eq, and, isNotNull, inArray } from "drizzle-orm";
import { getSetting, upsertSettings } from "./settings";
import { logger } from "./logger";

const API_VERSION = "2024-01";

// ── Config ────────────────────────────────────────────────────────────────

export interface ShopifyConfig {
  storeUrl: string; // e.g. "my-shop.myshopify.com"
  adminToken: string;
  storefrontToken: string;
}

/** Normalizes a store URL to a bare hostname (strips protocol/trailing slash). */
function normalizeStoreUrl(url: string): string {
  return url.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
}

export async function getShopifyConfig(): Promise<ShopifyConfig | null> {
  const [storeUrl, adminToken, storefrontToken] = await Promise.all([
    getSetting("shopifyStoreUrl"),
    getSetting("shopifyAdminToken"),
    getSetting("shopifyStorefrontToken"),
  ]);
  if (!storeUrl) return null;
  return {
    storeUrl: normalizeStoreUrl(storeUrl),
    adminToken: adminToken ?? "",
    storefrontToken: storefrontToken ?? "",
  };
}

// ── Admin REST helpers ────────────────────────────────────────────────────

async function adminGetRaw(config: ShopifyConfig, url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": config.adminToken,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify Admin API ${res.status} for ${url.split("?")[0]}: ${body.slice(0, 300)}`);
  }
  return res;
}

async function adminGet<T>(config: ShopifyConfig, path: string): Promise<T> {
  const res = await adminGetRaw(config, `https://${config.storeUrl}/admin/api/${API_VERSION}/${path}`);
  return res.json() as Promise<T>;
}

/** Extracts the rel="next" URL from a Shopify Link response header, if any. */
function nextPageUrl(res: Response): string | null {
  const link = res.headers.get("link");
  if (!link) return null;
  for (const part of link.split(",")) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/);
    if (m) return m[1];
  }
  return null;
}

/**
 * Fetches every page of a paginated Admin REST resource using cursor
 * (Link-header) pagination. `extract` pulls the item array out of each page.
 */
async function adminGetAllPages<TPage, TItem>(
  config: ShopifyConfig,
  firstPath: string,
  extract: (page: TPage) => TItem[],
): Promise<TItem[]> {
  const items: TItem[] = [];
  let url: string | null = `https://${config.storeUrl}/admin/api/${API_VERSION}/${firstPath}`;
  let pages = 0;
  // Runaway safety valve only — fail loudly rather than silently truncate.
  const MAX_PAGES = 10_000;
  while (url) {
    pages += 1;
    if (pages > MAX_PAGES) {
      throw new Error(`Shopify pagination exceeded ${MAX_PAGES} pages for ${firstPath}; aborting to avoid an incomplete sync being reported as success`);
    }
    const res: Response = await adminGetRaw(config, url);
    const page = (await res.json()) as TPage;
    items.push(...extract(page));
    url = nextPageUrl(res);
  }
  return items;
}

async function adminPost<T>(config: ShopifyConfig, path: string, payload: unknown): Promise<T> {
  const url = `https://${config.storeUrl}/admin/api/${API_VERSION}/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": config.adminToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify Admin API ${res.status} for ${path}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

// ── Shopify API shapes (subset) ───────────────────────────────────────────

interface ShopifyVariant {
  id: number;
  sku: string | null;
  price: string;
  compare_at_price: string | null;
  option1: string | null;
  option2: string | null;
  inventory_quantity?: number;
}

interface ShopifyImage {
  id: number;
  src: string;
  alt: string | null;
  position: number;
}

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string | null;
  status: string; // active | draft | archived
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

interface ShopifyCollection {
  id: number;
  title: string;
  products_count?: number;
}

export interface CollectionInfo {
  id: string;
  title: string;
  productCount: number;
  storeIds: number[];
}

// ── Collections listing (for the mapping UI) ─────────────────────────────

export async function listShopifyCollections(): Promise<CollectionInfo[]> {
  const config = await getShopifyConfig();
  if (!config || !config.adminToken) {
    throw new Error("Shopify is not configured. Set the store URL and Admin API token in Settings.");
  }

  const [customCollections, smartCollections, mappings] = await Promise.all([
    adminGetAllPages<{ custom_collections: ShopifyCollection[] }, ShopifyCollection>(config, "custom_collections.json?limit=250", (p) => p.custom_collections),
    adminGetAllPages<{ smart_collections: ShopifyCollection[] }, ShopifyCollection>(config, "smart_collections.json?limit=250", (p) => p.smart_collections).catch(() => [] as ShopifyCollection[]),
    db.select().from(shopifyCollectionStoreMappingsTable),
  ]);

  const collections = [...customCollections, ...smartCollections];

  // products_count is included on both collection resources; no collects scan needed
  return collections.map((c) => ({
    id: String(c.id),
    title: c.title,
    productCount: c.products_count ?? 0,
    storeIds: mappings.filter((m) => m.collectionId === String(c.id)).map((m) => m.storeId),
  }));
}

/**
 * Returns the product ids belonging to a collection. Works for both custom and
 * smart collections (the /collections/{id}/products endpoint resolves smart
 * collection rules server-side). Paginated.
 */
async function getCollectionProductIds(config: ShopifyConfig, collectionId: string): Promise<string[]> {
  const products = await adminGetAllPages<{ products: Array<{ id: number }> }, { id: number }>(
    config,
    `collections/${collectionId}/products.json?limit=250&fields=id`,
    (p) => p.products,
  );
  return products.map((p) => String(p.id));
}

// ── Catalog sync ──────────────────────────────────────────────────────────

export interface SyncSummary {
  success: boolean;
  message: string;
  productsCreated: number;
  productsUpdated: number;
  errors: number;
  syncedAt: string;
}

let syncInProgress = false;

export async function syncShopifyCatalog(): Promise<SyncSummary> {
  if (syncInProgress) {
    return { success: false, message: "A sync is already running.", productsCreated: 0, productsUpdated: 0, errors: 0, syncedAt: new Date().toISOString() };
  }
  syncInProgress = true;
  try {
    return await doSync();
  } finally {
    syncInProgress = false;
  }
}

async function doSync(): Promise<SyncSummary> {
  const syncedAt = new Date().toISOString();
  const config = await getShopifyConfig();
  if (!config || !config.adminToken) {
    return { success: false, message: "Shopify is not configured.", productsCreated: 0, productsUpdated: 0, errors: 0, syncedAt };
  }

  const mappings = await db.select().from(shopifyCollectionStoreMappingsTable);
  if (mappings.length === 0) {
    return { success: false, message: "No collection→store mappings configured. Map at least one collection to a store first.", productsCreated: 0, productsUpdated: 0, errors: 0, syncedAt };
  }

  let created = 0;
  let updated = 0;
  let errors = 0;

  try {
    // Full catalog, cursor-paginated
    const products = await adminGetAllPages<{ products: ShopifyProduct[] }, ShopifyProduct>(
      config, "products.json?limit=250", (p) => p.products,
    );

    // collectionId -> storeIds
    const storesByCollection = new Map<string, number[]>();
    for (const m of mappings) {
      const list = storesByCollection.get(m.collectionId) ?? [];
      list.push(m.storeId);
      storesByCollection.set(m.collectionId, list);
    }

    // shopifyProductId -> target storeIds. Membership comes from
    // /collections/{id}/products which resolves BOTH custom and smart
    // collections server-side, paginated.
    const storesByProduct = new Map<string, Set<number>>();
    // Stores whose membership data is incomplete (a mapped collection fetch
    // failed). Their products must NOT be reconciled/disabled this run —
    // absence of data is not absence of membership.
    const storesWithUnknownMembership = new Set<number>();
    for (const [collectionId, stores] of storesByCollection) {
      try {
        const productIds = await getCollectionProductIds(config, collectionId);
        for (const pid of productIds) {
          const set = storesByProduct.get(pid) ?? new Set<number>();
          for (const s of stores) set.add(s);
          storesByProduct.set(pid, set);
        }
      } catch (err) {
        errors += 1;
        for (const s of stores) storesWithUnknownMembership.add(s);
        logger.error({ err, collectionId }, "Shopify sync: failed to fetch collection membership; excluding affected stores from reconciliation");
      }
    }

    for (const sp of products) {
      const targetStores = storesByProduct.get(String(sp.id));
      if (!targetStores || targetStores.size === 0) continue;

      for (const storeId of targetStores) {
        try {
          const result = await upsertProduct(storeId, sp);
          if (result === "created") created += 1; else updated += 1;
        } catch (err) {
          errors += 1;
          logger.error({ err, shopifyProductId: sp.id, storeId }, "Shopify sync: product upsert failed");
        }
      }
    }

    // Reconcile: disable previously synced products that are no longer
    // targeted — deleted/archived in Shopify, removed from a mapped
    // collection, or whose collection was unmapped from the store.
    // (upsertProduct re-activates them if they come back.)
    // Only reconcile against a COMPLETE authoritative target set: stores with
    // any failed membership fetch are excluded so a transient Shopify error
    // can never wipe a live storefront's catalog.
    let disabled = 0;
    const syncedRows = await db
      .select({ id: productsTable.id, storeId: productsTable.storeId, shopifyProductId: productsTable.shopifyProductId, status: productsTable.status })
      .from(productsTable)
      .where(eq(productsTable.shopifySynced, true));
    for (const row of syncedRows) {
      if (storesWithUnknownMembership.has(row.storeId)) continue;
      const stillTargeted = row.shopifyProductId !== null && (storesByProduct.get(row.shopifyProductId)?.has(row.storeId) ?? false);
      if (!stillTargeted && row.status !== "disabled") {
        await db.update(productsTable).set({ status: "disabled" }).where(eq(productsTable.id, row.id));
        disabled += 1;
      }
    }

    const summary: SyncSummary = {
      success: true,
      message: `Synced ${created + updated} products (${created} created, ${updated} updated${disabled ? `, ${disabled} disabled` : ""}${errors ? `, ${errors} errors` : ""}).`,
      productsCreated: created,
      productsUpdated: updated,
      errors,
      syncedAt,
    };
    await upsertSettings([
      { key: "shopifyLastSyncAt", value: syncedAt },
      { key: "shopifyLastSyncSummary", value: summary.message },
    ]);
    logger.info(summary, "Shopify catalog sync finished");
    return summary;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Shopify catalog sync failed");
    await upsertSettings([
      { key: "shopifyLastSyncAt", value: syncedAt },
      { key: "shopifyLastSyncSummary", value: `Sync failed: ${message}` },
    ]).catch(() => {});
    return { success: false, message: `Sync failed: ${message}`, productsCreated: created, productsUpdated: updated, errors: errors + 1, syncedAt };
  }
}

function stripHtml(html: string | null): string | null {
  if (!html) return null;
  return html.replace(/<[^>]*>/g, "").trim() || null;
}

async function upsertProduct(storeId: number, sp: ShopifyProduct): Promise<"created" | "updated"> {
  const shopifyId = String(sp.id);
  const price = sp.variants[0]?.price ?? "0";
  const compareAt = sp.variants[0]?.compare_at_price ?? null;
  const status = sp.status === "active" ? "active" : "disabled";

  const [existing] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.storeId, storeId), eq(productsTable.shopifyProductId, shopifyId)));

  let productId: number;
  let mode: "created" | "updated";

  if (existing) {
    await db.update(productsTable).set({
      name: sp.title,
      description: stripHtml(sp.body_html),
      price,
      compareAtPrice: compareAt,
      status,
      shopifySynced: true,
    }).where(eq(productsTable.id, existing.id));
    productId = existing.id;
    mode = "updated";
  } else {
    const [row] = await db.insert(productsTable).values({
      storeId,
      name: sp.title,
      description: stripHtml(sp.body_html),
      price,
      compareAtPrice: compareAt,
      status,
      channel: "all",
      shopifyProductId: shopifyId,
      shopifySynced: true,
    }).returning();
    productId = row.id;
    mode = "created";
  }

  // Variants: upsert by shopify_variant_id, remove synced variants that vanished
  const existingVariants = await db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, productId));
  const seenVariantIds = new Set<string>();
  for (const sv of sp.variants) {
    const svId = String(sv.id);
    seenVariantIds.add(svId);
    const match = existingVariants.find((v) => v.shopifyVariantId === svId);
    const values = {
      color: sv.option1,
      size: sv.option2,
      sku: sv.sku || `SHOPIFY-${svId}`,
      inventory: sv.inventory_quantity ?? 0,
      price: sv.price,
      shopifyVariantId: svId,
    };
    if (match) {
      await db.update(productVariantsTable).set(values).where(eq(productVariantsTable.id, match.id));
    } else {
      await db.insert(productVariantsTable).values({ productId, ...values });
    }
  }
  for (const v of existingVariants) {
    if (v.shopifyVariantId && !seenVariantIds.has(v.shopifyVariantId)) {
      await db.delete(productVariantsTable).where(eq(productVariantsTable.id, v.id));
    }
  }

  // Images: replace wholesale (simple + idempotent)
  await db.delete(productImagesTable).where(eq(productImagesTable.productId, productId));
  if (sp.images.length > 0) {
    await db.insert(productImagesTable).values(
      sp.images.map((img) => ({
        productId,
        url: img.src,
        altText: img.alt,
        displayOrder: img.position,
      }))
    );
  }

  return mode;
}

// ── Background scheduler ──────────────────────────────────────────────────

let syncTimer: NodeJS.Timeout | null = null;

export async function startShopifySyncScheduler(): Promise<void> {
  const schedule = async () => {
    const intervalStr = await getSetting("shopifySyncIntervalMinutes", "60");
    const minutes = Math.max(5, parseInt(intervalStr ?? "60", 10) || 60);
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      try {
        const config = await getShopifyConfig();
        if (config?.adminToken) {
          logger.info("Running scheduled Shopify catalog sync");
          await syncShopifyCatalog();
        }
      } catch (err) {
        logger.error({ err }, "Scheduled Shopify sync failed");
      }
      void schedule(); // re-read interval each cycle so settings changes apply
    }, minutes * 60_000);
    syncTimer.unref?.();
  };
  await schedule();
  logger.info("Shopify sync scheduler started");
}

// ── B2C checkout (Storefront API) ─────────────────────────────────────────

export interface CheckoutLineItem {
  shopifyVariantId: string;
  quantity: number;
}

export async function createShopifyCheckout(items: CheckoutLineItem[], platformStoreId: number): Promise<string> {
  const config = await getShopifyConfig();
  if (!config || !config.storefrontToken) {
    throw new Error("Shopify Storefront API is not configured.");
  }

  const lines = items.map((i) => ({
    merchandiseId: `gid://shopify/ProductVariant/${i.shopifyVariantId}`,
    quantity: i.quantity,
  }));

  const query = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart { checkoutUrl }
        userErrors { field message }
      }
    }`;

  const res = await fetch(`https://${config.storeUrl}/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Storefront-Access-Token": config.storefrontToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: {
        input: {
          lines,
          // Propagated by Shopify to the order's note_attributes — this is the
          // authoritative store-routing key read back in the orders/create webhook.
          attributes: [{ key: "platform_store_id", value: String(platformStoreId) }],
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify Storefront API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json() as {
    data?: { cartCreate?: { cart?: { checkoutUrl?: string }; userErrors?: Array<{ message: string }> } };
    errors?: Array<{ message: string }>;
  };

  if (data.errors?.length) throw new Error(`Shopify GraphQL error: ${data.errors[0].message}`);
  const userErrors = data.data?.cartCreate?.userErrors ?? [];
  if (userErrors.length) throw new Error(`Shopify cart error: ${userErrors[0].message}`);
  const url = data.data?.cartCreate?.cart?.checkoutUrl;
  if (!url) throw new Error("Shopify did not return a checkout URL.");
  return url;
}

// ── Webhook HMAC verification ─────────────────────────────────────────────

export async function verifyShopifyWebhookHmac(rawBody: Buffer, hmacHeader: string | undefined): Promise<boolean> {
  if (!hmacHeader) return false;
  // Shared secret: dedicated webhook secret if set, else the Admin token (Shopify
  // uses the app's API secret; for custom apps operators paste it into settings).
  const secret = (await getSetting("shopifyWebhookSecret")) || (await getSetting("shopifyAdminToken"));
  if (!secret) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Webhook order ingestion ───────────────────────────────────────────────

interface ShopifyWebhookOrder {
  id: number;
  email: string | null;
  total_price: string;
  note_attributes?: Array<{ name: string; value: string }>;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
  shipping_address?: { address1?: string; city?: string; province?: string; zip?: string; country?: string } | null;
  line_items: Array<{
    product_id: number | null;
    variant_id: number | null;
    title: string;
    quantity: number;
    price: string;
  }>;
}

/**
 * Records a completed Shopify B2C order in the platform DB.
 * Returns the created platform order id, or null if it was skipped
 * (duplicate or no matching store).
 */
export async function recordShopifyOrder(payload: ShopifyWebhookOrder): Promise<number | null> {
  const shopifyOrderId = String(payload.id);

  // Resolve store from synced product ownership. The platform_store_id cart
  // attribute (set at checkout) is only a HINT — it is client-controllable, so
  // it must agree with product ownership before it is trusted.
  const shopifyProductIds = payload.line_items
    .filter((li) => li.product_id)
    .map((li) => String(li.product_id));

  // Only ACTIVE synced products establish ownership — disabled records (e.g.
  // products unmapped from a store) must not validate a routing hint or
  // resolve line items to that store.
  const owners = shopifyProductIds.length > 0
    ? await db.select({ id: productsTable.id, storeId: productsTable.storeId, shopifyProductId: productsTable.shopifyProductId })
        .from(productsTable)
        .where(and(inArray(productsTable.shopifyProductId, shopifyProductIds), eq(productsTable.status, "active")))
    : [];

  if (owners.length === 0) {
    logger.warn({ shopifyOrderId }, "Shopify webhook order has no line items matching synced platform products; skipping");
    return null;
  }

  // Count how many line items each candidate store owns.
  const lineCountByStore = new Map<number, number>();
  for (const li of payload.line_items) {
    if (!li.product_id) continue;
    const key = String(li.product_id);
    for (const storeCandidate of new Set(owners.filter((o) => o.shopifyProductId === key).map((o) => o.storeId))) {
      lineCountByStore.set(storeCandidate, (lineCountByStore.get(storeCandidate) ?? 0) + 1);
    }
  }

  const hintAttr = payload.note_attributes?.find((a) => a.name === "platform_store_id")?.value;
  const hintedStoreId = hintAttr ? parseInt(hintAttr, 10) : NaN;

  let storeId: number;
  if (!Number.isNaN(hintedStoreId) && lineCountByStore.has(hintedStoreId)) {
    storeId = hintedStoreId;
  } else {
    if (!Number.isNaN(hintedStoreId)) {
      logger.warn({ shopifyOrderId, hintedStoreId }, "Shopify webhook store hint does not own any order line items; falling back to product ownership");
    }
    // Store owning the most line items wins; deterministic tiebreak by id.
    storeId = [...lineCountByStore.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  }

  // The routed store must actually exist and be active.
  const [store] = await db.select({ id: storesTable.id, isActive: storesTable.isActive }).from(storesTable).where(eq(storesTable.id, storeId));
  if (!store || !store.isActive) {
    logger.warn({ shopifyOrderId, storeId }, "Shopify webhook resolved to a missing or inactive store; skipping");
    return null;
  }

  const customerName = [payload.customer?.first_name, payload.customer?.last_name].filter(Boolean).join(" ") || null;
  const addr = payload.shipping_address;
  const shippingAddress = addr
    ? [addr.address1, addr.city, addr.province, addr.zip, addr.country].filter(Boolean).join(", ")
    : null;

  // Resolve line items to platform products/variants before the transaction.
  // Only lines owned by the routed store are recorded; unresolved lines are
  // skipped (logged) rather than written with a bogus product reference.
  const itemValues: Array<Omit<typeof orderItemsTable.$inferInsert, "orderId">> = [];
  for (const li of payload.line_items) {
    const productId = li.product_id
      ? owners.find((o) => o.shopifyProductId === String(li.product_id) && o.storeId === storeId)?.id ?? null
      : null;
    if (!productId) {
      logger.warn({ shopifyOrderId, shopifyProductId: li.product_id ?? null, storeId }, "Shopify webhook line item does not resolve to a product in the routed store; skipping line");
      continue;
    }
    let variantId: number | null = null;
    if (li.variant_id) {
      const [v] = await db.select({ id: productVariantsTable.id }).from(productVariantsTable)
        .where(and(eq(productVariantsTable.shopifyVariantId, String(li.variant_id)), eq(productVariantsTable.productId, productId)));
      variantId = v?.id ?? null;
    }
    const unitPrice = parseFloat(li.price);
    itemValues.push({
      productId,
      productName: li.title,
      variantId,
      variantLabel: null,
      quantity: li.quantity,
      unitPrice: li.price,
      lineTotal: (unitPrice * li.quantity).toFixed(2),
      artworkId: null,
      artworkName: null,
      artworkUrl: null,
    });
  }

  if (itemValues.length === 0) {
    logger.warn({ shopifyOrderId, storeId }, "Shopify webhook order has no line items resolving to the routed store; skipping");
    return null;
  }

  // Atomic insert: order + items in one transaction. The partial unique index
  // orders_shopify_order_id_unique makes concurrent duplicate deliveries safe —
  // onConflictDoNothing returns no row, and we treat that as "already recorded".
  const orderId = await db.transaction(async (tx) => {
    const [order] = await tx.insert(ordersTable).values({
      storeId: storeId as number,
      type: "b2c",
      status: "received",
      fulfillmentStep: 1,
      total: payload.total_price,
      paymentTerms: "card",
      customerName,
      customerEmail: payload.email,
      shippingAddress,
      shopifyOrderId,
    }).onConflictDoNothing({
      target: ordersTable.shopifyOrderId,
      where: isNotNull(ordersTable.shopifyOrderId),
    }).returning({ id: ordersTable.id });

    if (!order) return null; // duplicate delivery — already recorded

    if (itemValues.length > 0) {
      await tx.insert(orderItemsTable).values(itemValues.map((v) => ({ ...v, orderId: order.id })));
    }
    return order.id;
  });

  if (orderId === null) {
    logger.info({ shopifyOrderId }, "Shopify order already recorded; skipping duplicate webhook delivery");
    return null;
  }

  logger.info({ shopifyOrderId, orderId, storeId }, "Recorded Shopify B2C order");
  return orderId;
}

// ── B2B draft order push ──────────────────────────────────────────────────

/**
 * Pushes a platform B2B order to Shopify as a draft order for fulfillment
 * tracking. Never throws — Shopify failure must not block the local save.
 */
export async function pushOrderToShopify(orderId: number): Promise<void> {
  try {
    const config = await getShopifyConfig();
    if (!config || !config.adminToken) return; // Shopify not configured — nothing to do

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!order || order.shopifyOrderId) return;

    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
    if (items.length === 0) return;

    let clientEmail: string | null = null;
    let companyName: string | null = null;
    if (order.b2bClientId) {
      const [client] = await db.select().from(b2bClientsTable).where(eq(b2bClientsTable.id, order.b2bClientId));
      clientEmail = client?.email ?? null;
      companyName = client?.companyName ?? null;
    }

    const lineItems = [];
    for (const item of items) {
      let shopifyVariantId: string | null = null;
      if (item.variantId) {
        const [v] = await db.select({ sid: productVariantsTable.shopifyVariantId }).from(productVariantsTable).where(eq(productVariantsTable.id, item.variantId));
        shopifyVariantId = v?.sid ?? null;
      }
      lineItems.push(
        shopifyVariantId
          ? { variant_id: parseInt(shopifyVariantId, 10), quantity: item.quantity, price: item.unitPrice }
          : { title: item.productName + (item.variantLabel ? ` (${item.variantLabel})` : ""), quantity: item.quantity, price: item.unitPrice }
      );
    }

    const payload = {
      draft_order: {
        line_items: lineItems,
        note: `Platform B2B order #${order.id}${companyName ? ` — ${companyName}` : ""} (${order.paymentTerms.toUpperCase()})`,
        tags: "platform-b2b",
        ...(clientEmail ? { email: clientEmail } : {}),
      },
    };

    const result = await adminPost<{ draft_order: { id: number } }>(config, "draft_orders.json", payload);
    await db.update(ordersTable).set({ shopifyOrderId: `draft:${result.draft_order.id}` }).where(eq(ordersTable.id, orderId));
    logger.info({ orderId, shopifyDraftOrderId: result.draft_order.id }, "Pushed B2B order to Shopify as draft order");
  } catch (err) {
    logger.error({ err, orderId }, "Failed to push B2B order to Shopify (local order is unaffected)");
  }
}

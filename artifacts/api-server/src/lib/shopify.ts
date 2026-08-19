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
import { eq, and, isNotNull, inArray, sql } from "drizzle-orm";
import { getSetting, upsertSettings } from "./settings";
import { logger } from "./logger";

// The REST helper remains for legacy reads and draft-order support while those
// paths are migrated. Product and collection writes use the current Admin
// GraphQL API below, because Shopify no longer supports REST product writes for
// newly created apps.
const API_VERSION = "2024-10";
const ADMIN_GRAPHQL_VERSION = "2026-01";

// ── Config ────────────────────────────────────────────────────────────────

export interface ShopifyConfig {
  storeUrl: string; // e.g. "my-shop.myshopify.com"
  adminToken: string;
  storefrontToken: string;
}

/** Normalizes a store URL to a bare hostname (strips protocol/trailing slash). */
function normalizeStoreUrl(url: string): string {
  const host = url.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host)) {
    throw new Error("Shopify store URL must be a valid *.myshopify.com domain.");
  }
  return host;
}

export async function getShopifyConfig(): Promise<ShopifyConfig | null> {
  const [storeUrl, adminToken, storefrontToken] = await Promise.all([
    getSetting("shopifyStoreUrl"),
    getSetting("shopifyAdminToken"),
    getSetting("shopifyStorefrontToken"),
  ]);
  if (!storeUrl) return null;
  let normalizedStoreUrl: string;
  try {
    normalizedStoreUrl = normalizeStoreUrl(storeUrl);
  } catch (err) {
    logger.warn({ err }, "Ignoring invalid Shopify store URL");
    return null;
  }
  return {
    storeUrl: normalizedStoreUrl,
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

async function adminPut<T>(config: ShopifyConfig, path: string, payload: unknown): Promise<T> {
  const url = `https://${config.storeUrl}/admin/api/${API_VERSION}/${path}`;
  const res = await fetch(url, {
    method: "PUT",
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

async function adminGraphql<T>(
  config: ShopifyConfig,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const url = `https://${config.storeUrl}/admin/api/${ADMIN_GRAPHQL_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": config.adminToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.text();
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Shopify denied product write access. A super admin must re-connect Shopify to approve the write_products permission, then retry.",
      );
    }
    throw new Error(`Shopify Admin GraphQL ${res.status}: ${body.slice(0, 300)}`);
  }
  const response = JSON.parse(body) as { data?: T; errors?: Array<{ message?: string }> };
  if (response.errors?.length) {
    throw new Error(`Shopify Admin GraphQL: ${response.errors[0]?.message ?? "unknown error"}`);
  }
  if (!response.data) {
    throw new Error("Shopify Admin GraphQL returned no data.");
  }
  return response.data;
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

async function tryAcquireShopifyLock(key: string): Promise<boolean> {
  const result = await db.execute<{ locked: boolean }>(
    sql`SELECT pg_try_advisory_lock(hashtext(${key})) AS locked`,
  );
  return result.rows[0]?.locked === true;
}

async function releaseShopifyLock(key: string): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_unlock(hashtext(${key}))`);
}

export async function syncShopifyCatalog(storeId?: number): Promise<SyncSummary> {
  if (syncInProgress) {
    return { success: false, message: "A sync is already running.", productsCreated: 0, productsUpdated: 0, errors: 0, syncedAt: new Date().toISOString() };
  }
  syncInProgress = true;
  // A store-scoped manual import and the scheduled all-store import touch the
  // same Shopify catalog, so they deliberately share one distributed lock.
  const lockKey = "shopify-catalog-sync";
  let acquired = false;
  try {
    acquired = await tryAcquireShopifyLock(lockKey);
    if (!acquired) {
      return { success: false, message: "A catalog sync is already running on another server.", productsCreated: 0, productsUpdated: 0, errors: 0, syncedAt: new Date().toISOString() };
    }
    return await doSync(storeId);
  } finally {
    if (acquired) {
      await releaseShopifyLock(lockKey).catch((err) => logger.warn({ err, lockKey }, "Could not release Shopify catalog lock"));
    }
    syncInProgress = false;
  }
}

async function doSync(storeId?: number): Promise<SyncSummary> {
  const syncedAt = new Date().toISOString();
  const config = await getShopifyConfig();
  if (!config || !config.adminToken) {
    return { success: false, message: "Shopify is not configured.", productsCreated: 0, productsUpdated: 0, errors: 0, syncedAt };
  }

  const allMappings = await db.select().from(shopifyCollectionStoreMappingsTable);
  const mappings = storeId === undefined
    ? allMappings
    : allMappings.filter((mapping) => mapping.storeId === storeId);
  if (mappings.length === 0) {
    return {
      success: false,
      message: storeId === undefined
        ? "No collection→store mappings configured. Map at least one collection to a store first."
        : "This storefront has no Shopify collection mappings. Ask a super admin to map a collection to this storefront first.",
      productsCreated: 0,
      productsUpdated: 0,
      errors: 0,
      syncedAt,
    };
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
       if (storeId !== undefined && row.storeId !== storeId) continue;
      if (storesWithUnknownMembership.has(row.storeId)) continue;
      const stillTargeted = row.shopifyProductId !== null && (storesByProduct.get(row.shopifyProductId)?.has(row.storeId) ?? false);
       // A missing Shopify id means this is a local-only product. It must never
       // be disabled because a previous push failed or an older app version
       // incorrectly marked it as synced without establishing a real link.
       if (row.shopifyProductId !== null && !stillTargeted && row.status !== "disabled") {
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

type PlatformProduct = typeof productsTable.$inferSelect;
type PlatformVariant = typeof productVariantsTable.$inferSelect;
type PlatformImage = typeof productImagesTable.$inferSelect;

function localStatusToShopify(status: string): "ACTIVE" | "DRAFT" {
  return status === "active" ? "ACTIVE" : "DRAFT";
}

function shopifyProductInput(
  product: PlatformProduct,
) {
  return {
    title: product.name,
    descriptionHtml: product.description ?? "",
    status: localStatusToShopify(product.status),
  };
}

function toShopifyGid(resource: "Product" | "ProductVariant" | "Collection", id: string | number): string {
  const value = String(id);
  return value.startsWith("gid://") ? value : `gid://shopify/${resource}/${value}`;
}

interface ShopifyGraphqlUserError {
  field?: string[];
  message: string;
}

interface ShopifyGraphqlProduct {
  id: string;
  legacyResourceId: string;
  variants: {
    nodes: Array<{ id: string; legacyResourceId: string }>;
  };
  media: {
    nodes: Array<{ id: string }>;
  };
}

interface VariantOptionPlan {
  optionNames: string[];
  productOptions?: Array<{ name: string; values: Array<{ name: string }> }>;
}

function variantOptionPlan(variants: PlatformVariant[]): VariantOptionPlan {
  if (variants.length <= 1) return { optionNames: [] };
  const hasColor = variants.some((variant) => !!variant.color);
  const hasSize = variants.some((variant) => !!variant.size);
  if (!hasColor && !hasSize) {
    return {
      optionNames: ["Title"],
      productOptions: [{ name: "Title", values: variants.map((variant) => ({ name: variant.sku })) }],
    };
  }
  const options: Array<{ name: string; values: Array<{ name: string }> }> = [];
  if (hasColor) {
    options.push({ name: "Color", values: [...new Set(variants.map((variant) => variant.color || "Default"))].map((name) => ({ name })) });
  }
  if (hasSize) {
    options.push({ name: "Size", values: [...new Set(variants.map((variant) => variant.size || "Default"))].map((name) => ({ name })) });
  }
  return { optionNames: options.map((option) => option.name), productOptions: options };
}

function variantInput(product: PlatformProduct, variant: PlatformVariant, optionNames: string[], id?: string) {
  const optionValues = optionNames.map((optionName) => ({
    optionName,
    name: optionName === "Color"
      ? variant.color || "Default"
      : optionName === "Size"
        ? variant.size || "Default"
        : variant.sku,
  }));
  return {
    ...(id ? { id: toShopifyGid("ProductVariant", id) } : {}),
    price: String(variant.price ?? product.price),
    ...(product.compareAtPrice ? { compareAtPrice: String(product.compareAtPrice) } : {}),
    inventoryItem: { sku: variant.sku },
    ...(optionValues.length > 0 ? { optionValues } : {}),
  };
}

function throwForUserErrors(errors: ShopifyGraphqlUserError[], action: string): void {
  if (errors.length > 0) {
    throw new Error(`Shopify could not ${action}: ${errors.map((error) => error.message).join("; ")}`);
  }
}

async function linkProductMedia(
  productId: number,
  images: PlatformImage[],
  remoteMedia: Array<{ id: string }>,
): Promise<void> {
  const pendingImages = images.filter((image) => !image.shopifyMediaId);
  const mappedMedia = remoteMedia.slice(-pendingImages.length);
  for (let index = 0; index < pendingImages.length; index += 1) {
    const media = mappedMedia[index];
    if (!media) continue;
    await db.update(productImagesTable)
      .set({ shopifyMediaId: media.id })
      .where(eq(productImagesTable.id, pendingImages[index].id));
  }
}

async function createProductWithGraphql(
  config: ShopifyConfig,
  product: PlatformProduct,
  variants: PlatformVariant[],
  images: PlatformImage[],
): Promise<ShopifyGraphqlProduct> {
  const optionPlan = variantOptionPlan(variants);
  const data = await adminGraphql<{
    productCreate: { product: ShopifyGraphqlProduct | null; userErrors: ShopifyGraphqlUserError[] };
  }>(
    config,
    `mutation ProductCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
      productCreate(product: $product, media: $media) {
        product {
          id
          legacyResourceId
          variants(first: 1) {
            nodes { id legacyResourceId }
          }
          media(first: 250) {
            nodes { id }
          }
        }
        userErrors { field message }
      }
    }`,
    {
      product: {
        ...shopifyProductInput(product),
        ...(optionPlan.productOptions ? { productOptions: optionPlan.productOptions } : {}),
      },
      media: images.map((image) => ({
        originalSource: image.url,
        mediaContentType: "IMAGE",
        ...(image.altText ? { alt: image.altText } : {}),
      })),
    },
  );
  throwForUserErrors(data.productCreate.userErrors, "create this product");
  if (!data.productCreate.product) {
    throw new Error("Shopify did not return the newly created product.");
  }
  return data.productCreate.product;
}

async function updateProductWithGraphql(
  config: ShopifyConfig,
  product: PlatformProduct,
): Promise<void> {
  const data = await adminGraphql<{
    productUpdate: { userErrors: ShopifyGraphqlUserError[] };
  }>(
    config,
    `mutation ProductUpdate($product: ProductUpdateInput!) {
      productUpdate(product: $product) {
        userErrors { field message }
      }
    }`,
    {
      product: {
        id: toShopifyGid("Product", product.shopifyProductId!),
        ...shopifyProductInput(product),
      },
    },
  );
  throwForUserErrors(data.productUpdate.userErrors, "update this product");
}

async function syncProductMedia(
  config: ShopifyConfig,
  product: PlatformProduct,
  images: PlatformImage[],
): Promise<void> {
  const pendingImages = images.filter((image) => !image.shopifyMediaId);
  if (pendingImages.length === 0) return;
  const data = await adminGraphql<{
    productUpdate: {
      product: { media: { nodes: Array<{ id: string }> } } | null;
      userErrors: ShopifyGraphqlUserError[];
    };
  }>(
    config,
    `mutation ProductAddMedia($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
      productUpdate(product: $product, media: $media) {
        product { media(first: 250) { nodes { id } } }
        userErrors { field message }
      }
    }`,
    {
      product: { id: toShopifyGid("Product", product.shopifyProductId!) },
      media: pendingImages.map((image) => ({
        originalSource: image.url,
        mediaContentType: "IMAGE",
        ...(image.altText ? { alt: image.altText } : {}),
      })),
    },
  );
  throwForUserErrors(data.productUpdate.userErrors, "add product images");
  await linkProductMedia(product.id, pendingImages, data.productUpdate.product?.media.nodes ?? []);
}

async function mappedCustomCollectionIds(config: ShopifyConfig, storeId: number): Promise<string[]> {
  const mappings = await db
    .select({ collectionId: shopifyCollectionStoreMappingsTable.collectionId })
    .from(shopifyCollectionStoreMappingsTable)
    .where(eq(shopifyCollectionStoreMappingsTable.storeId, storeId));

  if (mappings.length === 0) {
    return [];
  }

  const customCollections = await adminGetAllPages<{ custom_collections: ShopifyCollection[] }, ShopifyCollection>(
    config,
    "custom_collections.json?limit=250",
    (page) => page.custom_collections,
  );
  const customIds = new Set(customCollections.map((collection) => String(collection.id)));
  return mappings.map((mapping) => mapping.collectionId).filter((id) => customIds.has(id));
}

async function addProductToCollections(
  config: ShopifyConfig,
  productId: string,
  collectionIds: string[],
): Promise<void> {
  for (const collectionId of collectionIds) {
    const data = await adminGraphql<{
      collectionAddProducts: { userErrors: ShopifyGraphqlUserError[] };
    }>(
      config,
      `mutation CollectionAddProducts($id: ID!, $productIds: [ID!]!) {
        collectionAddProducts(id: $id, productIds: $productIds) {
          userErrors { field message }
        }
      }`,
      {
        id: toShopifyGid("Collection", collectionId),
        productIds: [toShopifyGid("Product", productId)],
      },
    );
    const nonDuplicateErrors = data.collectionAddProducts.userErrors.filter((error) => {
      const message = error.message.toLowerCase();
      return !message.includes("already") && !message.includes("exists");
    });
    if (nonDuplicateErrors.length > 0) {
      throwForUserErrors(nonDuplicateErrors, "add this product to its mapped collection");
    }
  }
}

async function productOptionNames(
  config: ShopifyConfig,
  product: PlatformProduct,
): Promise<string[]> {
  const data = await adminGraphql<{ product: { options: Array<{ name: string }> } | null }>(
    config,
    `query ProductOptions($id: ID!) { product(id: $id) { options { name } } }`,
    { id: toShopifyGid("Product", product.shopifyProductId!) },
  );
  return data.product?.options.map((option) => option.name) ?? [];
}

async function syncVariantsWithGraphql(
  config: ShopifyConfig,
  product: PlatformProduct,
  variants: PlatformVariant[],
  optionNames?: string[],
): Promise<void> {
  const names = optionNames ?? await productOptionNames(config, product);
  const linked = variants.filter((variant) => variant.shopifyVariantId);
  if (linked.length > 0) {
    const data = await adminGraphql<{
      productVariantsBulkUpdate: { userErrors: ShopifyGraphqlUserError[] };
    }>(
      config,
      `mutation ProductVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          userErrors { field message }
        }
      }`,
      {
        productId: toShopifyGid("Product", product.shopifyProductId!),
        variants: linked.map((variant) => variantInput(product, variant, names, variant.shopifyVariantId!)),
      },
    );
    throwForUserErrors(data.productVariantsBulkUpdate.userErrors, "update product variants");
  }

  const unlinked = variants.filter((variant) => !variant.shopifyVariantId);
  if (unlinked.length > 0) {
    const data = await adminGraphql<{
      productVariantsBulkCreate: {
        productVariants: Array<{ legacyResourceId: string }>;
        userErrors: ShopifyGraphqlUserError[];
      };
    }>(
      config,
      `mutation ProductVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkCreate(productId: $productId, variants: $variants) {
          productVariants { legacyResourceId }
          userErrors { field message }
        }
      }`,
      {
        productId: toShopifyGid("Product", product.shopifyProductId!),
        variants: unlinked.map((variant) => variantInput(product, variant, names)),
      },
    );
    throwForUserErrors(data.productVariantsBulkCreate.userErrors, "create product variants");
    for (let index = 0; index < unlinked.length; index += 1) {
      const remote = data.productVariantsBulkCreate.productVariants[index];
      if (!remote) continue;
      await db.update(productVariantsTable).set({ shopifyVariantId: remote.legacyResourceId })
        .where(eq(productVariantsTable.id, unlinked[index].id));
    }
  }

  // Local editing is authoritative for a pushed product. Query Shopify after
  // creates/updates so variants removed in the platform are not reintroduced
  // by a later pull-sync.
  const retained = await db
    .select({ shopifyVariantId: productVariantsTable.shopifyVariantId })
    .from(productVariantsTable)
    .where(eq(productVariantsTable.productId, product.id));
  const retainedIds = new Set(retained.flatMap((variant) => variant.shopifyVariantId ? [variant.shopifyVariantId] : []));
  const remote = await adminGraphql<{
    product: { variants: { nodes: Array<{ id: string; legacyResourceId: string }> } } | null;
  }>(
    config,
    `query ProductVariants($id: ID!) {
      product(id: $id) { variants(first: 250) { nodes { id legacyResourceId } } }
    }`,
    { id: toShopifyGid("Product", product.shopifyProductId!) },
  );
  const staleVariantIds = remote.product?.variants.nodes
    .filter((variant) => !retainedIds.has(variant.legacyResourceId))
    .map((variant) => variant.id) ?? [];
  if (staleVariantIds.length > 0 && retainedIds.size > 0) {
    const deletion = await adminGraphql<{
      productVariantsBulkDelete: { userErrors: ShopifyGraphqlUserError[] };
    }>(
      config,
      `mutation ProductVariantsBulkDelete($productId: ID!, $variantsIds: [ID!]!) {
        productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
          userErrors { field message }
        }
      }`,
      {
        productId: toShopifyGid("Product", product.shopifyProductId!),
        variantsIds: staleVariantIds,
      },
    );
    throwForUserErrors(deletion.productVariantsBulkDelete.userErrors, "remove retired product variants");
  }
}

/**
 * Pushes one store-admin product into Shopify. A new product is placed in all
 * mapped manual collections for its storefront, which keeps it eligible for
 * subsequent pull-syncs. Smart collection membership remains controlled by
 * Shopify's rules and cannot be assigned directly.
 */
export async function pushProductToShopify(storeId: number, productId: number): Promise<{ created: boolean; shopifyProductId: string }> {
  const lockKey = `shopify-product-push:${storeId}:${productId}`;
  if (!await tryAcquireShopifyLock(lockKey)) {
    throw new Error("This product is already being synchronized by another server. Please wait and try again.");
  }
  try {
    return await pushProductToShopifyUnlocked(storeId, productId);
  } finally {
    await releaseShopifyLock(lockKey).catch((err) => logger.warn({ err, lockKey }, "Could not release Shopify product lock"));
  }
}

async function pushProductToShopifyUnlocked(storeId: number, productId: number): Promise<{ created: boolean; shopifyProductId: string }> {
  const config = await getShopifyConfig();
  if (!config?.adminToken) {
    throw new Error("Shopify is not connected. A super admin must connect Shopify before products can sync.");
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.id, productId), eq(productsTable.storeId, storeId)));
  if (!product) {
    throw new Error("Product not found for this storefront.");
  }

  const [variants, images] = await Promise.all([
    db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, productId)),
    db.select().from(productImagesTable).where(eq(productImagesTable.productId, productId)),
  ]);
  // Earlier builds exposed a simulated "sync" control which marked products
  // as synced without receiving a Shopify id. That impossible combination is
  // repaired on the first real push so the product is not kept disabled.
  const productForPush = product.shopifySynced && !product.shopifyProductId
    ? { ...product, status: "active" }
    : product;

  if (product.shopifyProductId) {
    await updateProductWithGraphql(config, productForPush);
    await syncProductMedia(config, productForPush, images);
    await syncVariantsWithGraphql(config, productForPush, variants);
    await db
      .update(productsTable)
      .set({ shopifySynced: true })
      .where(eq(productsTable.id, product.id));
    logger.info({ productId, storeId, shopifyProductId: product.shopifyProductId }, "Updated platform product in Shopify");
    return { created: false, shopifyProductId: product.shopifyProductId };
  }

  const collectionIds = await mappedCustomCollectionIds(config, storeId);
  if (collectionIds.length === 0) {
    throw new Error(
      "This storefront has no mapped manual Shopify collection. Map a manual collection to the storefront in Super Admin → Settings before creating products from the platform.",
    );
  }

  const created = await createProductWithGraphql(config, productForPush, variants, images);

  try {
    await addProductToCollections(config, created.legacyResourceId, collectionIds);
  } catch (err) {
    logger.error({ err, productId, storeId, shopifyProductId: created.legacyResourceId }, "Created Shopify product but could not add it to mapped collections");
    throw new Error(
      "Shopify created the product but could not add it to this storefront's mapped collection. Add it to a mapped manual collection in Shopify, then run an import.",
    );
  }

  await db
    .update(productsTable)
    .set({
      shopifyProductId: created.legacyResourceId,
      shopifySynced: true,
      // Repair the invalid state produced by the previous simulated sync:
      // a product without an external id cannot be treated as disabled by sync.
      status: productForPush.status,
    })
    .where(eq(productsTable.id, product.id));
  await linkProductMedia(product.id, images, created.media.nodes);
  const defaultVariant = created.variants.nodes[0];
  if (variants[0] && defaultVariant) {
    await db
      .update(productVariantsTable)
      .set({ shopifyVariantId: defaultVariant.legacyResourceId })
      .where(eq(productVariantsTable.id, variants[0].id));
  }
  // productCreate always gives Shopify one default variant. Update that exact
  // variant with the first local record, then create only the remaining local
  // variants. Keeping the ID in memory prevents the default from being created
  // a second time during this same push.
  const variantsWithDefaultLink = variants.map((variant, index) =>
    index === 0 && defaultVariant
      ? { ...variant, shopifyVariantId: defaultVariant.legacyResourceId }
      : variant,
  );
  await syncVariantsWithGraphql(
    config,
    { ...productForPush, shopifyProductId: created.legacyResourceId },
    variantsWithDefaultLink,
    variantOptionPlan(variants).optionNames,
  );

  logger.info({ productId, storeId, shopifyProductId: created.legacyResourceId }, "Created platform product in Shopify");
  return { created: true, shopifyProductId: created.legacyResourceId };
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
    const values = {
      storeId,
      name: sp.title,
      description: stripHtml(sp.body_html),
      price,
      compareAtPrice: compareAt,
      status,
      channel: "all",
      shopifyProductId: shopifyId,
      shopifySynced: true,
    };
    try {
      const [row] = await db.insert(productsTable).values(values).returning();
      productId = row.id;
      mode = "created";
    } catch (err) {
      // The database uniqueness constraint is the final safeguard when a
      // deployment is scaled while a previous replica still holds stale work.
      const [winner] = await db
        .select()
        .from(productsTable)
        .where(and(eq(productsTable.storeId, storeId), eq(productsTable.shopifyProductId, shopifyId)));
      if (!winner) throw err;
      await db.update(productsTable).set({
        name: values.name,
        description: values.description,
        price: values.price,
        compareAtPrice: values.compareAtPrice,
        status: values.status,
        shopifySynced: true,
      }).where(eq(productsTable.id, winner.id));
      productId = winner.id;
      mode = "updated";
    }
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
        shopifyMediaId: `gid://shopify/MediaImage/${img.id}`,
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
  // Shopify signs standard app webhooks with the OAuth app client secret. The
  // legacy webhook setting is only a fallback for stores migrated from an older
  // custom integration; it must never fall back to an access token.
  const secret = (await getSetting("shopifyClientSecret")) || (await getSetting("shopifyWebhookSecret"));
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

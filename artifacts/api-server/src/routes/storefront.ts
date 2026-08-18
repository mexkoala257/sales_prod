import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  storesTable,
  productsTable,
  productVariantsTable,
  productImagesTable,
  productCategoriesTable,
  categoriesTable,
  ordersTable,
  orderItemsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { CreateB2COrderBody } from "@workspace/api-zod";
import { getSetting } from "../lib/settings";

const router: IRouter = Router();

// ── Feature flag guard ────────────────────────────────────────────
// Applied to all per-store endpoints (config, products, categories, orders).
// The top-level /storefront listing is intentionally left unguarded so
// the frontend can still render store names with a "Coming Soon" badge.
async function requireStorefrontFeature(_req: Request, res: Response, next: NextFunction): Promise<void> {
  const enabled = await getSetting("featureB2CStorefront", "true");
  if (enabled === "false") {
    res.status(503).json({ error: "B2C Storefront is currently disabled." });
    return;
  }
  next();
}

// ── Public store listing ──────────────────────────────────────────
router.get("/storefront", async (_req, res): Promise<void> => {
  const stores = await db
    .select({
      id: storesTable.id,
      name: storesTable.name,
      slug: storesTable.slug,
      logoText: storesTable.logoText,
      primaryColor: storesTable.primaryColor,
      accentColor: storesTable.accentColor,
      announcementBar: storesTable.announcementBar,
    })
    .from(storesTable)
    .where(eq(storesTable.isActive, true));
  res.json(stores);
});

// ── Shared config builder ─────────────────────────────────────────
function storeConfigResponse(store: typeof storesTable.$inferSelect) {
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    logoText: store.logoText,
    logoImageUrl: store.logoImageUrl,
    announcementBar: store.announcementBar,
    primaryColor: store.primaryColor,
    accentColor: store.accentColor,
    fontFamily: store.fontFamily,
  };
}

// ── Domain resolver ───────────────────────────────────────────────
// Must come before /:storeSlug/* routes so "resolve" isn't treated as a slug.
router.get("/storefront/resolve", async (req, res): Promise<void> => {
  let domain = String(req.query.domain ?? "").trim().toLowerCase();
  if (!domain) { res.status(400).json({ error: "domain query param required" }); return; }
  // Normalise: strip www. so "www.brand.com" and "brand.com" both match the apex stored in DB
  if (domain.startsWith("www.")) domain = domain.slice(4);

  const [store] = await db
    .select()
    .from(storesTable)
    .where(and(eq(storesTable.customDomain, domain), eq(storesTable.isActive, true)));

  if (!store) { res.status(404).json({ error: "No active storefront found for this domain" }); return; }
  res.json(storeConfigResponse(store));
});

// ── Store config ──────────────────────────────────────────────────
router.get("/storefront/:storeSlug/config", requireStorefrontFeature, async (req, res): Promise<void> => {
  const storeSlug = String(req.params.storeSlug);
  const [store] = await db.select().from(storesTable).where(eq(storesTable.slug, storeSlug));
  if (!store || !store.isActive) { res.status(404).json({ error: "Storefront not found" }); return; }
  res.json(storeConfigResponse(store));
});

// ── Products ──────────────────────────────────────────────────────
async function buildPublicProduct(p: any) {
  const variants = await db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, p.id));
  const images = await db.select().from(productImagesTable).where(eq(productImagesTable.productId, p.id));
  const categoryRows = await db.select().from(productCategoriesTable).where(eq(productCategoriesTable.productId, p.id));
  return {
    ...p,
    price: parseFloat(p.price as string),
    compareAtPrice: p.compareAtPrice ? parseFloat(p.compareAtPrice as string) : null,
    shopifySynced: p.shopifySynced ?? false,
    variants: variants.map((v) => ({ ...v, price: v.price ? parseFloat(v.price as string) : null })),
    images,
    categories: categoryRows.map((r) => r.categoryId),
  };
}

router.get("/storefront/:storeSlug/products", requireStorefrontFeature, async (req, res): Promise<void> => {
  const storeSlug = String(req.params.storeSlug);
  const { categoryId, search } = req.query as { categoryId?: string; search?: string };

  const [store] = await db.select().from(storesTable).where(eq(storesTable.slug, storeSlug));
  if (!store || !store.isActive) { res.status(404).json({ error: "Storefront not found" }); return; }

  const products = await db.select().from(productsTable).where(
    and(eq(productsTable.storeId, store.id), eq(productsTable.status, "active"))
  );

  let filtered = products.filter((p) => p.channel === "all" || p.channel === "b2c");

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((p) => p.name.toLowerCase().includes(q));
  }

  if (categoryId) {
    const cId = parseInt(categoryId, 10);
    const inCat = await db.select({ productId: productCategoriesTable.productId }).from(productCategoriesTable).where(eq(productCategoriesTable.categoryId, cId));
    const inCatSet = new Set(inCat.map((r) => r.productId));
    filtered = filtered.filter((p) => inCatSet.has(p.id));
  }

  const result = await Promise.all(filtered.map(buildPublicProduct));
  res.json(result);
});

router.get("/storefront/:storeSlug/products/:productId", requireStorefrontFeature, async (req, res): Promise<void> => {
  const storeSlug = String(req.params.storeSlug);
  const id = parseInt(String(req.params.productId), 10);

  const [store] = await db.select().from(storesTable).where(eq(storesTable.slug, storeSlug));
  if (!store || !store.isActive) { res.status(404).json({ error: "Storefront not found" }); return; }

  const [product] = await db.select().from(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.storeId, store.id)));
  if (!product || product.status !== "active") { res.status(404).json({ error: "Product not found" }); return; }

  res.json(await buildPublicProduct(product));
});

// ── Categories ────────────────────────────────────────────────────
router.get("/storefront/:storeSlug/categories", requireStorefrontFeature, async (req, res): Promise<void> => {
  const storeSlug = String(req.params.storeSlug);
  const [store] = await db.select().from(storesTable).where(eq(storesTable.slug, storeSlug));
  if (!store || !store.isActive) { res.status(404).json({ error: "Storefront not found" }); return; }

  const cats = await db.select().from(categoriesTable).where(eq(categoriesTable.storeId, store.id));
  const result = await Promise.all(
    cats.map(async (c) => {
      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(productCategoriesTable).where(eq(productCategoriesTable.categoryId, c.id));
      return { ...c, productCount: Number(countRow.count) };
    })
  );

  res.json(result);
});

// ── B2C Orders ────────────────────────────────────────────────────
router.post("/storefront/:storeSlug/orders", requireStorefrontFeature, async (req, res): Promise<void> => {
  const storeSlug = String(req.params.storeSlug);
  const [store] = await db.select().from(storesTable).where(eq(storesTable.slug, storeSlug));
  if (!store || !store.isActive) { res.status(404).json({ error: "Storefront not found" }); return; }

  const parsed = CreateB2COrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { items, customerName, customerEmail, paymentTerms, notes, shippingAddress } = parsed.data as any;
  const total = items.reduce((sum: number, item: any) => sum + item.unitPrice * item.quantity, 0);

  const [order] = await db
    .insert(ordersTable)
    .values({
      storeId: store.id,
      type: "b2c",
      status: "received",
      fulfillmentStep: 1,
      total: total.toString(),
      paymentTerms,
      customerName,
      customerEmail,
      notes,
      shippingAddress,
    })
    .returning();

  if (items.length > 0) {
    const itemValues = await Promise.all(
      items.map(async (item: any) => {
        const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
        let variantLabel: string | null = null;
        if (item.variantId) {
          const [variant] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, item.variantId));
          if (variant) variantLabel = [variant.color, variant.size].filter(Boolean).join(" / ");
        }
        return {
          orderId: order.id,
          productId: item.productId,
          productName: product?.name ?? "Unknown",
          variantId: item.variantId ?? null,
          variantLabel,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          lineTotal: (item.unitPrice * item.quantity).toString(),
          artworkId: null,
          artworkName: null,
          artworkUrl: null,
        };
      })
    );
    await db.insert(orderItemsTable).values(itemValues);
  }

  const orderItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  res.status(201).json({
    ...order,
    total: parseFloat(order.total as string),
    storeName: store.name,
    b2bCompanyName: null,
    items: orderItems.map((i) => ({ ...i, unitPrice: parseFloat(i.unitPrice as string), lineTotal: parseFloat(i.lineTotal as string) })),
  });
});

export default router;

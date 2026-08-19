import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  productsTable,
  productVariantsTable,
  productImagesTable,
  productCategoriesTable,
  b2bClientProductsTable,
  categoriesTable,
  b2bClientsTable,
  ordersTable,
  orderItemsTable,
  storesTable,
} from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireStoreAdmin } from "../middlewares/auth";
import type { JwtPayload } from "../middlewares/auth";
import {
  CreateProductBody,
  UpdateProductBody,
  CreateCategoryBody,
  UpdateCategoryBody,
  CreateB2BClientBody,
  UpdateB2BClientBody,
  SetB2BClientProductsBody,
  UpdateOrderStatusBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getStoreId(req: any): number {
  return (req.user as JwtPayload).storeId!;
}

// ── Dashboard ─────────────────────────────────────────────────────
router.get("/admin/dashboard", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);

  const [total] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.storeId, storeId));
  const [active] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(and(eq(productsTable.storeId, storeId), eq(productsTable.status, "active")));
  const [b2bCount] = await db.select({ count: sql<number>`count(*)` }).from(b2bClientsTable).where(eq(b2bClientsTable.storeId, storeId));
  const orders = await db
    .select({ order: ordersTable })
    .from(ordersTable)
    .where(eq(ordersTable.storeId, storeId))
    .orderBy(ordersTable.createdAt);

  const pending = orders.filter((o) => o.order.status !== "delivered").length;
  const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.order.total as string), 0);
  const recentOrders = orders.slice(-10).reverse().map(({ order }) => ({
    ...order, total: parseFloat(order.total as string), items: [], storeName: null, b2bCompanyName: null,
  }));

  res.json({
    totalProducts: Number(total.count),
    activeProducts: Number(active.count),
    totalOrders: orders.length,
    pendingOrders: pending,
    totalRevenue,
    b2bClients: Number(b2bCount.count),
    recentOrders,
  });
});

// ── Products ──────────────────────────────────────────────────────
async function buildProductResponse(storeId: number, productId: number) {
  const [product] = await db.select().from(productsTable).where(and(eq(productsTable.id, productId), eq(productsTable.storeId, storeId)));
  if (!product) return null;

  const variants = await db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, productId));
  const images = await db.select().from(productImagesTable).where(eq(productImagesTable.productId, productId));
  const categoryRows = await db.select().from(productCategoriesTable).where(eq(productCategoriesTable.productId, productId));

  return {
    ...product,
    price: parseFloat(product.price as string),
    compareAtPrice: product.compareAtPrice ? parseFloat(product.compareAtPrice as string) : null,
    variants: variants.map((v) => ({ ...v, price: v.price ? parseFloat(v.price as string) : null })),
    images,
    categories: categoryRows.map((r) => r.categoryId),
  };
}

router.get("/admin/products", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const { status, channel } = req.query as { status?: string; channel?: string };

  let query = db.select().from(productsTable).where(eq(productsTable.storeId, storeId)).$dynamic();

  const products = await db.select().from(productsTable).where(eq(productsTable.storeId, storeId));

  const filtered = products.filter((p) => {
    if (status && p.status !== status) return false;
    if (channel && p.channel !== channel) return false;
    return true;
  });

  const result = await Promise.all(
    filtered.map(async (p) => {
      const variants = await db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, p.id));
      const images = await db.select().from(productImagesTable).where(eq(productImagesTable.productId, p.id));
      const categoryRows = await db.select().from(productCategoriesTable).where(eq(productCategoriesTable.productId, p.id));
      return {
        ...p,
        price: parseFloat(p.price as string),
        compareAtPrice: p.compareAtPrice ? parseFloat(p.compareAtPrice as string) : null,
        variants: variants.map((v) => ({ ...v, price: v.price ? parseFloat(v.price as string) : null })),
        images,
        categories: categoryRows.map((r) => r.categoryId),
      };
    })
  );

  res.json(result);
});

router.post("/admin/products", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { variants = [], images = [], categoryIds = [], ...productData } = parsed.data as any;

  const [product] = await db.insert(productsTable).values({ ...productData, storeId }).returning();

  if (variants.length > 0) {
    await db.insert(productVariantsTable).values(variants.map((v: any) => ({ ...v, productId: product.id })));
  }
  if (images.length > 0) {
    await db.insert(productImagesTable).values(images.map((img: any) => ({ ...img, productId: product.id })));
  }
  if (categoryIds.length > 0) {
    await db.insert(productCategoriesTable).values(categoryIds.map((cId: number) => ({ productId: product.id, categoryId: cId })));
  }

  const full = await buildProductResponse(storeId, product.id);
  res.status(201).json(full);
});

router.get("/admin/products/import-shopify", requireStoreAdmin, async (_req, res): Promise<void> => {
  // Demo mode — stub
  res.json({ success: true, message: "Demo mode: Shopify import simulated. Connect real credentials to sync.", synced: 0, errors: 0 });
});

router.post("/admin/products/import-shopify", requireStoreAdmin, async (_req, res): Promise<void> => {
  res.json({ success: true, message: "Demo mode: Shopify import simulated. Connect real credentials to sync.", synced: 0, errors: 0 });
});

router.get("/admin/products/:productId", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const id = parseInt(req.params.productId as string, 10);
  const product = await buildProductResponse(storeId, id);
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(product);
});

router.patch("/admin/products/:productId", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const id = parseInt(req.params.productId as string, 10);
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { variants, images, categoryIds, ...productData } = parsed.data as any;

  await db.update(productsTable).set(productData).where(and(eq(productsTable.id, id), eq(productsTable.storeId, storeId)));

  if (variants !== undefined) {
    await db.delete(productVariantsTable).where(eq(productVariantsTable.productId, id));
    if (variants.length > 0) {
      await db.insert(productVariantsTable).values(variants.map((v: any) => ({ ...v, productId: id })));
    }
  }
  if (images !== undefined) {
    await db.delete(productImagesTable).where(eq(productImagesTable.productId, id));
    if (images.length > 0) {
      await db.insert(productImagesTable).values(images.map((img: any) => ({ ...img, productId: id })));
    }
  }
  if (categoryIds !== undefined) {
    await db.delete(productCategoriesTable).where(eq(productCategoriesTable.productId, id));
    if (categoryIds.length > 0) {
      await db.insert(productCategoriesTable).values(categoryIds.map((cId: number) => ({ productId: id, categoryId: cId })));
    }
  }

  const full = await buildProductResponse(storeId, id);
  if (!full) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(full);
});

router.delete("/admin/products/:productId", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const id = parseInt(req.params.productId as string, 10);
  await db.delete(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.storeId, storeId)));
  res.sendStatus(204);
});

router.post("/admin/products/:productId/sync-shopify", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const id = parseInt(req.params.productId as string, 10);
  // Demo mode stub
  await db.update(productsTable).set({ shopifySynced: true }).where(and(eq(productsTable.id, id), eq(productsTable.storeId, storeId)));
  res.json({ success: true, message: "Demo mode: Product synced to Shopify (simulated).", synced: 1, errors: 0 });
});

// ── Categories ────────────────────────────────────────────────────
router.get("/admin/categories", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const cats = await db.select().from(categoriesTable).where(eq(categoriesTable.storeId, storeId));

  const result = await Promise.all(
    cats.map(async (c) => {
      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(productCategoriesTable).where(eq(productCategoriesTable.categoryId, c.id));
      return { ...c, productCount: Number(countRow.count) };
    })
  );

  res.json(result);
});

router.post("/admin/categories", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [cat] = await db.insert(categoriesTable).values({ ...parsed.data, storeId }).returning();
  res.status(201).json({ ...cat, productCount: 0 });
});

router.patch("/admin/categories/:categoryId", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const id = parseInt(req.params.categoryId as string, 10);
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [cat] = await db.update(categoriesTable).set(parsed.data).where(and(eq(categoriesTable.id, id), eq(categoriesTable.storeId, storeId))).returning();
  if (!cat) { res.status(404).json({ error: "Category not found" }); return; }
  const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(productCategoriesTable).where(eq(productCategoriesTable.categoryId, id));
  res.json({ ...cat, productCount: Number(countRow.count) });
});

router.delete("/admin/categories/:categoryId", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const id = parseInt(req.params.categoryId as string, 10);
  await db.delete(categoriesTable).where(and(eq(categoriesTable.id, id), eq(categoriesTable.storeId, storeId)));
  res.sendStatus(204);
});

// ── B2B Accounts ──────────────────────────────────────────────────
router.get("/admin/b2b-accounts", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const clients = await db.select().from(b2bClientsTable).where(eq(b2bClientsTable.storeId, storeId));

  const result = await Promise.all(
    clients.map(async (c) => {
      const assigned = await db.select({ productId: b2bClientProductsTable.productId }).from(b2bClientProductsTable).where(eq(b2bClientProductsTable.b2bClientId, c.id));
      return { ...c, discountPercent: parseFloat(c.discountPercent as string), assignedProductIds: assigned.map((r) => r.productId) };
    })
  );

  res.json(result);
});

router.post("/admin/b2b-accounts", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const parsed = CreateB2BClientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { password, ...rest } = parsed.data as any;
  const passwordHash = await bcrypt.hash(password, 10);

  const [client] = await db.insert(b2bClientsTable).values({ ...rest, passwordHash, storeId }).returning();
  res.status(201).json({ ...client, discountPercent: parseFloat(client.discountPercent as string), assignedProductIds: [] });
});

router.get("/admin/b2b-accounts/:clientId", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const id = parseInt(req.params.clientId as string, 10);
  const [client] = await db.select().from(b2bClientsTable).where(and(eq(b2bClientsTable.id, id), eq(b2bClientsTable.storeId, storeId)));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }
  const assigned = await db.select({ productId: b2bClientProductsTable.productId }).from(b2bClientProductsTable).where(eq(b2bClientProductsTable.b2bClientId, id));
  res.json({ ...client, discountPercent: parseFloat(client.discountPercent as string), assignedProductIds: assigned.map((r) => r.productId) });
});

router.patch("/admin/b2b-accounts/:clientId", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const id = parseInt(req.params.clientId as string, 10);
  const parsed = UpdateB2BClientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // discountPercent is number in Zod but Drizzle's numeric column expects string at the type level
  const { discountPercent, ...rest } = parsed.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {
    ...rest,
    ...(discountPercent !== undefined ? { discountPercent: String(discountPercent) } : {}),
  };
  const [client] = await db.update(b2bClientsTable).set(updateData).where(and(eq(b2bClientsTable.id, id), eq(b2bClientsTable.storeId, storeId))).returning();
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }
  const assigned = await db.select({ productId: b2bClientProductsTable.productId }).from(b2bClientProductsTable).where(eq(b2bClientProductsTable.b2bClientId, id));
  res.json({ ...client, discountPercent: parseFloat(client.discountPercent as string), assignedProductIds: assigned.map((r) => r.productId) });
});

router.delete("/admin/b2b-accounts/:clientId", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const id = parseInt(req.params.clientId as string, 10);
  await db.delete(b2bClientsTable).where(and(eq(b2bClientsTable.id, id), eq(b2bClientsTable.storeId, storeId)));
  res.sendStatus(204);
});

router.get("/admin/b2b-accounts/:clientId/products", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const id = parseInt(req.params.clientId as string, 10);
  const [client] = await db.select({ id: b2bClientsTable.id }).from(b2bClientsTable)
    .where(and(eq(b2bClientsTable.id, id), eq(b2bClientsTable.storeId, storeId)));
  if (!client) { res.status(404).json({ error: "B2B client not found" }); return; }
  const rows = await db.select({ productId: b2bClientProductsTable.productId }).from(b2bClientProductsTable).where(eq(b2bClientProductsTable.b2bClientId, id));
  res.json({ productIds: rows.map((r) => r.productId) });
});

router.put("/admin/b2b-accounts/:clientId/products", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const id = parseInt(req.params.clientId as string, 10);
  const parsed = SetB2BClientProductsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [client] = await db.select({ id: b2bClientsTable.id }).from(b2bClientsTable)
    .where(and(eq(b2bClientsTable.id, id), eq(b2bClientsTable.storeId, storeId)));
  if (!client) { res.status(404).json({ error: "B2B client not found" }); return; }

  const requestedProductIds = [...new Set(parsed.data.productIds)];
  if (requestedProductIds.length > 0) {
    const storeProducts = await db.select({ id: productsTable.id }).from(productsTable).where(
      and(eq(productsTable.storeId, storeId), inArray(productsTable.id, requestedProductIds))
    );
    if (storeProducts.length !== requestedProductIds.length) {
      res.status(400).json({ error: "Every assigned product must belong to this storefront." });
      return;
    }
  }

  await db.delete(b2bClientProductsTable).where(eq(b2bClientProductsTable.b2bClientId, id));
  if (requestedProductIds.length > 0) {
    await db.insert(b2bClientProductsTable).values(requestedProductIds.map((pid) => ({ b2bClientId: id, productId: pid })));
  }

  res.json({ productIds: requestedProductIds });
});

// ── Orders ────────────────────────────────────────────────────────
async function buildOrderResponse(order: any) {
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  let b2bCompanyName: string | null = null;
  if (order.b2bClientId) {
    const [client] = await db.select({ companyName: b2bClientsTable.companyName }).from(b2bClientsTable).where(eq(b2bClientsTable.id, order.b2bClientId));
    b2bCompanyName = client?.companyName ?? null;
  }
  return {
    ...order,
    total: parseFloat(order.total as string),
    b2bCompanyName,
    storeName: null,
    items: items.map((i) => ({ ...i, unitPrice: parseFloat(i.unitPrice as string), lineTotal: parseFloat(i.lineTotal as string) })),
  };
}

router.get("/admin/orders", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const { type, status } = req.query as { type?: string; status?: string };

  const orders = await db.select().from(ordersTable).where(eq(ordersTable.storeId, storeId));
  const filtered = orders.filter((o) => {
    if (type && o.type !== type) return false;
    if (status && o.status !== status) return false;
    return true;
  });

  const result = await Promise.all(filtered.map(buildOrderResponse));
  res.json(result);
});

router.get("/admin/orders/:orderId", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const id = parseInt(req.params.orderId as string, 10);
  const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, id), eq(ordersTable.storeId, storeId)));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(await buildOrderResponse(order));
});

router.patch("/admin/orders/:orderId/status", requireStoreAdmin, async (req, res): Promise<void> => {
  const storeId = getStoreId(req);
  const id = parseInt(req.params.orderId as string, 10);
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [order] = await db
    .update(ordersTable)
    .set({ status: parsed.data.status, fulfillmentStep: parsed.data.fulfillmentStep })
    .where(and(eq(ordersTable.id, id), eq(ordersTable.storeId, storeId)))
    .returning();
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(await buildOrderResponse(order));
});

export default router;

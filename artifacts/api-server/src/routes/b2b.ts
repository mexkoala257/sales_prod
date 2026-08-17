import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  b2bClientsTable,
  b2bClientProductsTable,
  productsTable,
  productVariantsTable,
  productImagesTable,
  artworkTable,
  ordersTable,
  orderItemsTable,
  storesTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireB2BClient } from "../middlewares/auth";
import type { JwtPayload } from "../middlewares/auth";
import { CreateB2BOrderBody } from "@workspace/api-zod";
import { getSetting } from "../lib/settings";

const router: IRouter = Router();

// ── Feature flag guard ────────────────────────────────────────────
async function requireB2BFeature(_req: Request, res: Response, next: NextFunction): Promise<void> {
  const enabled = await getSetting("featureB2BPortal", "true");
  if (enabled === "false") {
    res.status(403).json({ error: "B2B Portal is currently disabled." });
    return;
  }
  next();
}

router.use("/b2b", requireB2BFeature);

function getClientId(req: any): number {
  return (req.user as JwtPayload).id;
}
function getStoreId(req: any): number {
  return (req.user as JwtPayload).storeId!;
}

// ── Profile ───────────────────────────────────────────────────────
router.get("/b2b/profile", requireB2BClient, async (req, res): Promise<void> => {
  const clientId = getClientId(req);
  const [client] = await db.select().from(b2bClientsTable).where(eq(b2bClientsTable.id, clientId));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }
  const [store] = await db.select().from(storesTable).where(eq(storesTable.id, client.storeId));
  res.json({
    id: client.id,
    email: client.email,
    companyName: client.companyName,
    contactName: client.contactName,
    phone: client.phone,
    discountPercent: parseFloat(client.discountPercent as string),
    paymentTerms: client.paymentTerms,
    storeName: store?.name ?? "",
  });
});

// ── Catalog helpers ───────────────────────────────────────────────
async function buildCatalogProduct(clientId: number, product: any) {
  const [client] = await db.select({ discountPercent: b2bClientsTable.discountPercent }).from(b2bClientsTable).where(eq(b2bClientsTable.id, clientId));
  const discountPercent = parseFloat(client?.discountPercent as string ?? "0");
  const price = parseFloat(product.price as string);
  const wholesalePrice = price * (1 - discountPercent / 100);

  const variants = await db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, product.id));
  const images = await db.select().from(productImagesTable).where(eq(productImagesTable.productId, product.id));

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price,
    wholesalePrice: Math.round(wholesalePrice * 100) / 100,
    discountPercent,
    status: product.status,
    preOrder: product.preOrder,
    preOrderNotice: product.preOrderNotice,
    variants: variants.map((v) => ({ ...v, price: v.price ? parseFloat(v.price as string) : null })),
    images,
  };
}

// ── Catalog ───────────────────────────────────────────────────────
router.get("/b2b/catalog", requireB2BClient, async (req, res): Promise<void> => {
  const clientId = getClientId(req);
  const storeId = getStoreId(req);

  const assigned = await db.select({ productId: b2bClientProductsTable.productId }).from(b2bClientProductsTable).where(eq(b2bClientProductsTable.b2bClientId, clientId));
  const productIds = assigned.map((r) => r.productId);

  let products: any[] = [];
  if (productIds.length > 0) {
    products = await db.select().from(productsTable).where(
      and(eq(productsTable.storeId, storeId), inArray(productsTable.id, productIds), eq(productsTable.status, "active"))
    );
  }

  const result = await Promise.all(products.map((p) => buildCatalogProduct(clientId, p)));
  res.json(result);
});

// ── Matrix ────────────────────────────────────────────────────────
router.get("/b2b/matrix", requireB2BClient, async (req, res): Promise<void> => {
  const clientId = getClientId(req);
  const storeId = getStoreId(req);

  const assigned = await db.select({ productId: b2bClientProductsTable.productId }).from(b2bClientProductsTable).where(eq(b2bClientProductsTable.b2bClientId, clientId));
  const productIds = assigned.map((r) => r.productId);

  let products: any[] = [];
  if (productIds.length > 0) {
    products = await db.select().from(productsTable).where(
      and(eq(productsTable.storeId, storeId), inArray(productsTable.id, productIds), eq(productsTable.status, "active"))
    );
  }

  const result = await Promise.all(products.map((p) => buildCatalogProduct(clientId, p)));
  res.json(result);
});

// ── Artwork ───────────────────────────────────────────────────────
router.get("/b2b/artwork", requireB2BClient, async (req, res): Promise<void> => {
  const clientId = getClientId(req);
  const artworks = await db.select().from(artworkTable).where(eq(artworkTable.b2bClientId, clientId));
  res.json(artworks.map((a) => ({ ...a, uploadedAt: a.uploadedAt.toISOString() })));
});

// POST /b2b/artwork — register artwork after presigned upload
router.post("/b2b/artwork", requireB2BClient, async (req, res): Promise<void> => {
  const artworkEnabled = await getSetting("featureArtworkUploads", "true");
  if (artworkEnabled === "false") {
    res.status(403).json({ error: "Artwork uploads are currently disabled." });
    return;
  }

  const clientId = getClientId(req);
  const { objectPath, name, fileType, fileSizeBytes } = req.body;

  if (!objectPath || !name || !fileType) {
    res.status(400).json({ error: "objectPath, name, and fileType are required" });
    return;
  }

  // Build serving URL from objectPath
  const url = `/api/storage${objectPath}`;

  const [artwork] = await db
    .insert(artworkTable)
    .values({ b2bClientId: clientId, name, url, fileType, fileSizeBytes: fileSizeBytes ?? null })
    .returning();

  res.status(201).json({ ...artwork, uploadedAt: artwork.uploadedAt.toISOString() });
});

router.delete("/b2b/artwork/:artworkId", requireB2BClient, async (req, res): Promise<void> => {
  const clientId = getClientId(req);
  const id = parseInt(req.params.artworkId as string, 10);
  await db.delete(artworkTable).where(and(eq(artworkTable.id, id), eq(artworkTable.b2bClientId, clientId)));
  res.sendStatus(204);
});

// ── Orders ────────────────────────────────────────────────────────
router.get("/b2b/orders", requireB2BClient, async (req, res): Promise<void> => {
  const clientId = getClientId(req);
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.b2bClientId, clientId));

  const result = await Promise.all(
    orders.map(async (order) => {
      const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
      return {
        ...order,
        total: parseFloat(order.total as string),
        storeName: null,
        b2bCompanyName: null,
        items: items.map((i) => ({ ...i, unitPrice: parseFloat(i.unitPrice as string), lineTotal: parseFloat(i.lineTotal as string) })),
      };
    })
  );

  res.json(result);
});

router.post("/b2b/orders", requireB2BClient, async (req, res): Promise<void> => {
  const clientId = getClientId(req);
  const storeId = getStoreId(req);
  const parsed = CreateB2BOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { items, paymentTerms, notes, shippingAddress } = parsed.data as any;
  const total = items.reduce((sum: number, item: any) => sum + item.unitPrice * item.quantity, 0);

  const [order] = await db
    .insert(ordersTable)
    .values({
      storeId,
      type: "b2b",
      status: "received",
      fulfillmentStep: 1,
      total: total.toString(),
      paymentTerms,
      b2bClientId: clientId,
      notes,
      shippingAddress,
    })
    .returning();

  // Fetch product names for items
  const [client] = await db.select().from(b2bClientsTable).where(eq(b2bClientsTable.id, clientId));
  const discountPercent = parseFloat(client?.discountPercent as string ?? "0");

  if (items.length > 0) {
    const orderItemValues = await Promise.all(
      items.map(async (item: any) => {
        const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
        let variantLabel: string | null = null;
        if (item.variantId) {
          const [variant] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, item.variantId));
          if (variant) variantLabel = [variant.color, variant.size].filter(Boolean).join(" / ");
        }
        let artworkName: string | null = null;
        let artworkUrl: string | null = null;
        if (item.artworkId) {
          const [art] = await db.select().from(artworkTable).where(eq(artworkTable.id, item.artworkId));
          if (art) { artworkName = art.name; artworkUrl = art.url; }
        }
        const lineTotal = item.unitPrice * item.quantity;
        return {
          orderId: order.id,
          productId: item.productId,
          productName: product?.name ?? "Unknown",
          variantId: item.variantId ?? null,
          variantLabel,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          lineTotal: lineTotal.toString(),
          artworkId: item.artworkId ?? null,
          artworkName,
          artworkUrl,
        };
      })
    );
    await db.insert(orderItemsTable).values(orderItemValues);
  }

  const orderItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  res.status(201).json({
    ...order,
    total: parseFloat(order.total as string),
    storeName: null,
    b2bCompanyName: client?.companyName ?? null,
    items: orderItems.map((i) => ({ ...i, unitPrice: parseFloat(i.unitPrice as string), lineTotal: parseFloat(i.lineTotal as string) })),
  });
});

router.get("/b2b/orders/:orderId", requireB2BClient, async (req, res): Promise<void> => {
  const clientId = getClientId(req);
  const id = parseInt(req.params.orderId as string, 10);
  const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, id), eq(ordersTable.b2bClientId, clientId)));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
  res.json({
    ...order,
    total: parseFloat(order.total as string),
    storeName: null,
    b2bCompanyName: null,
    items: items.map((i) => ({ ...i, unitPrice: parseFloat(i.unitPrice as string), lineTotal: parseFloat(i.lineTotal as string) })),
  });
});

export default router;

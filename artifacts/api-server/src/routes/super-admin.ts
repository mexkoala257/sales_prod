import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  storesTable,
  usersTable,
  ordersTable,
  orderItemsTable,
  productsTable,
  b2bClientsTable,
} from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { requireSuperAdmin } from "../middlewares/auth";
import {
  CreateStoreBody,
  UpdateStoreBody,
  CreateStoreAdminBody,
  UpdateOrderStatusSuperAdminBody,
} from "@workspace/api-zod";
import { getAllSettings, upsertSettings } from "../lib/settings";

const router: IRouter = Router();

// ── Analytics ─────────────────────────────────────────────────────
router.get("/super-admin/analytics", requireSuperAdmin, async (req, res): Promise<void> => {
  const stores = await db.select().from(storesTable);

  const allOrders = await db
    .select({
      id: ordersTable.id,
      storeId: ordersTable.storeId,
      type: ordersTable.type,
      total: ordersTable.total,
    })
    .from(ordersTable);

  const totalRevenue = allOrders.reduce((sum, o) => sum + parseFloat(o.total as string), 0);
  const b2bOrders = allOrders.filter((o) => o.type === "b2b");
  const b2cOrders = allOrders.filter((o) => o.type === "b2c");

  const storeBreakdown = stores.map((s) => {
    const storeOrders = allOrders.filter((o) => o.storeId === s.id);
    const revenue = storeOrders.reduce((sum, o) => sum + parseFloat(o.total as string), 0);
    return {
      storeId: s.id,
      storeName: s.name,
      revenue,
      orders: storeOrders.length,
      b2bOrders: storeOrders.filter((o) => o.type === "b2b").length,
      b2cOrders: storeOrders.filter((o) => o.type === "b2c").length,
    };
  });

  res.json({
    totalRevenue,
    totalOrders: allOrders.length,
    b2bRevenue: b2bOrders.reduce((sum, o) => sum + parseFloat(o.total as string), 0),
    b2cRevenue: b2cOrders.reduce((sum, o) => sum + parseFloat(o.total as string), 0),
    b2bOrders: b2bOrders.length,
    b2cOrders: b2cOrders.length,
    storeBreakdown,
  });
});

// ── Stores CRUD ────────────────────────────────────────────────────
router.get("/super-admin/stores", requireSuperAdmin, async (_req, res): Promise<void> => {
  const stores = await db.select().from(storesTable);

  const result = await Promise.all(
    stores.map(async (s) => {
      const [adminCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(usersTable)
        .where(eq(usersTable.storeId, s.id));
      const [productCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(productsTable)
        .where(eq(productsTable.storeId, s.id));
      const orders = await db
        .select({ total: ordersTable.total })
        .from(ordersTable)
        .where(eq(ordersTable.storeId, s.id));
      return {
        ...s,
        adminCount: Number(adminCount.count),
        productCount: Number(productCount.count),
        orderCount: orders.length,
        totalRevenue: orders.reduce((sum, o) => sum + parseFloat(o.total as string), 0),
      };
    })
  );

  res.json(result);
});

router.post("/super-admin/stores", requireSuperAdmin, async (req, res): Promise<void> => {
  const parsed = CreateStoreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [store] = await db.insert(storesTable).values(parsed.data).returning();
  res.status(201).json({ ...store, adminCount: 0, productCount: 0, orderCount: 0, totalRevenue: 0 });
});

router.get("/super-admin/stores/:storeId", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.storeId as string, 10);
  const [store] = await db.select().from(storesTable).where(eq(storesTable.id, id));
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }

  const [adminCount] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.storeId, id));
  const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.storeId, id));
  const orders = await db.select({ total: ordersTable.total }).from(ordersTable).where(eq(ordersTable.storeId, id));

  res.json({
    ...store,
    adminCount: Number(adminCount.count),
    productCount: Number(productCount.count),
    orderCount: orders.length,
    totalRevenue: orders.reduce((sum, o) => sum + parseFloat(o.total as string), 0),
  });
});

router.patch("/super-admin/stores/:storeId", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.storeId as string, 10);
  const parsed = UpdateStoreBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [store] = await db.update(storesTable).set(parsed.data).where(eq(storesTable.id, id)).returning();
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }

  const [adminCount] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.storeId, id));
  const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.storeId, id));
  const orders = await db.select({ total: ordersTable.total }).from(ordersTable).where(eq(ordersTable.storeId, id));

  res.json({
    ...store,
    adminCount: Number(adminCount.count),
    productCount: Number(productCount.count),
    orderCount: orders.length,
    totalRevenue: orders.reduce((sum, o) => sum + parseFloat(o.total as string), 0),
  });
});

router.delete("/super-admin/stores/:storeId", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.storeId as string, 10);
  await db.delete(storesTable).where(eq(storesTable.id, id));
  res.sendStatus(204);
});

// ── Store Admins ───────────────────────────────────────────────────
router.get("/super-admin/stores/:storeId/admins", requireSuperAdmin, async (req, res): Promise<void> => {
  const storeId = parseInt(req.params.storeId as string, 10);
  const admins = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.storeId, storeId), eq(usersTable.role, "store_admin")));

  const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId));
  res.json(admins.map((a) => ({ id: a.id, email: a.email, storeId: a.storeId, storeName: store?.name ?? "", createdAt: a.createdAt })));
});

router.post("/super-admin/stores/:storeId/admins", requireSuperAdmin, async (req, res): Promise<void> => {
  const storeId = parseInt(req.params.storeId as string, 10);
  const parsed = CreateStoreAdminBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId));
  if (!store) { res.status(404).json({ error: "Store not found" }); return; }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const [admin] = await db
    .insert(usersTable)
    .values({ email: parsed.data.email, passwordHash, role: "store_admin", storeId })
    .returning();

  res.status(201).json({ id: admin.id, email: admin.email, storeId, storeName: store.name, createdAt: admin.createdAt });
});

router.delete("/super-admin/stores/:storeId/admins/:adminId", requireSuperAdmin, async (req, res): Promise<void> => {
  const adminId = parseInt(req.params.adminId as string, 10);
  await db.delete(usersTable).where(eq(usersTable.id, adminId));
  res.sendStatus(204);
});

// ── All Orders ─────────────────────────────────────────────────────
router.get("/super-admin/orders", requireSuperAdmin, async (req, res): Promise<void> => {
  const orders = await db
    .select({
      order: ordersTable,
      storeName: storesTable.name,
    })
    .from(ordersTable)
    .leftJoin(storesTable, eq(ordersTable.storeId, storesTable.id))
    .orderBy(ordersTable.createdAt);

  const result = await Promise.all(
    orders.map(async ({ order, storeName }) => {
      const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
      let b2bCompanyName: string | null = null;
      if (order.b2bClientId) {
        const [client] = await db.select({ companyName: b2bClientsTable.companyName }).from(b2bClientsTable).where(eq(b2bClientsTable.id, order.b2bClientId));
        b2bCompanyName = client?.companyName ?? null;
      }
      return {
        ...order,
        total: parseFloat(order.total as string),
        storeName: storeName ?? null,
        b2bCompanyName,
        items: items.map((i) => ({ ...i, unitPrice: parseFloat(i.unitPrice as string), lineTotal: parseFloat(i.lineTotal as string) })),
      };
    })
  );

  res.json(result);
});

router.patch("/super-admin/orders/:orderId/status", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.orderId as string, 10);
  const parsed = UpdateOrderStatusSuperAdminBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [order] = await db
    .update(ordersTable)
    .set({ status: parsed.data.status, fulfillmentStep: parsed.data.fulfillmentStep })
    .where(eq(ordersTable.id, id))
    .returning();
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  res.json({ ...order, total: parseFloat(order.total as string), items: [] });
});

// ── Platform Settings ──────────────────────────────────────────────
router.get("/super-admin/settings", requireSuperAdmin, async (_req, res): Promise<void> => {
  const settings = await getAllSettings();
  res.json(settings);
});

router.put("/super-admin/settings", requireSuperAdmin, async (req, res): Promise<void> => {
  const body = req.body as { settings?: unknown };
  if (!Array.isArray(body?.settings)) {
    res.status(400).json({ error: "Body must have a 'settings' array" });
    return;
  }

  const inputs = (body.settings as Array<Record<string, unknown>>).map((s) => ({
    key: String(s.key ?? ""),
    value: String(s.value ?? ""),
    isSecret: Boolean(s.isSecret ?? false),
  })).filter((s) => s.key.length > 0);

  const updated = await upsertSettings(inputs);
  res.json(updated);
});

router.post("/super-admin/settings/test-email", requireSuperAdmin, async (_req, res): Promise<void> => {
  // Real SMTP sending is tracked in Task #8 (install nodemailer and wire credentials).
  // Until that task is complete this endpoint intentionally returns success:false so the
  // UI never implies a real message was delivered.
  res.json({
    success: false,
    message: "SMTP test sending is not yet implemented. Configure your SMTP settings and check back after Task #8 is complete.",
  });
});

export default router;

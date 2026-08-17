import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  b2bClientsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { signToken, verifyToken } from "../middlewares/auth";
import {
  LoginSuperAdminBody,
  LoginAdminBody,
  LoginB2BBody,
  ChangeB2BPasswordBody,
} from "@workspace/api-zod";
import { getSetting } from "../lib/settings";

const router: IRouter = Router();

// ── Super Admin Login ─────────────────────────────────────────────
router.post("/auth/super-admin/login", async (req, res): Promise<void> => {
  const parsed = LoginSuperAdminBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, email), eq(usersTable.role, "super_admin")));

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ id: user.id, email: user.email, role: "super_admin" });
  res.json({
    token,
    user: { id: user.id, email: user.email, role: "super_admin", storeId: null, storeName: null, storeSlug: null, companyName: null, forcePasswordChange: null },
  });
});

// ── Store Admin Login ──────────────────────────────────────────────
router.post("/auth/admin/login", async (req, res): Promise<void> => {
  const parsed = LoginAdminBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, email), eq(usersTable.role, "store_admin")));

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Get store info
  const { storesTable } = await import("@workspace/db");
  const [store] = user.storeId
    ? await db.select().from(storesTable).where(eq(storesTable.id, user.storeId))
    : [];

  const token = signToken({ id: user.id, email: user.email, role: "store_admin", storeId: user.storeId });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: "store_admin",
      storeId: user.storeId ?? null,
      storeName: store?.name ?? null,
      storeSlug: store?.slug ?? null,
      companyName: null,
      forcePasswordChange: null,
    },
  });
});

// ── B2B Client Login ───────────────────────────────────────────────
router.post("/auth/b2b/login", async (req, res): Promise<void> => {
  const b2bEnabled = await getSetting("featureB2BPortal", "true");
  if (b2bEnabled === "false") {
    res.status(403).json({ error: "B2B Portal is currently disabled." });
    return;
  }
  const parsed = LoginB2BBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;

  const [client] = await db
    .select()
    .from(b2bClientsTable)
    .where(eq(b2bClientsTable.email, email));

  if (!client || !(await bcrypt.compare(password, client.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (!client.isActive) {
    res.status(403).json({ error: "Account is disabled" });
    return;
  }

  const { storesTable } = await import("@workspace/db");
  const [store] = await db.select().from(storesTable).where(eq(storesTable.id, client.storeId));

  const token = signToken({ id: client.id, email: client.email, role: "b2b_client", storeId: client.storeId, b2bClientId: client.id });
  res.json({
    token,
    user: {
      id: client.id,
      email: client.email,
      role: "b2b_client",
      storeId: client.storeId,
      storeName: store?.name ?? null,
      storeSlug: store?.slug ?? null,
      companyName: client.companyName,
      forcePasswordChange: client.forcePasswordChange,
    },
  });
});

// ── B2B Change Password ────────────────────────────────────────────
router.post("/auth/b2b/change-password", async (req, res): Promise<void> => {
  const b2bEnabled = await getSetting("featureB2BPortal", "true");
  if (b2bEnabled === "false") {
    res.status(403).json({ error: "B2B Portal is currently disabled." });
    return;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  let payload: any;
  try {
    payload = verifyToken(authHeader.slice(7));
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  if (payload.role !== "b2b_client") {
    res.status(403).json({ error: "B2B client access required" });
    return;
  }

  const parsed = ChangeB2BPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [client] = await db.select().from(b2bClientsTable).where(eq(b2bClientsTable.id, payload.id));
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  if (!(await bcrypt.compare(parsed.data.currentPassword, client.passwordHash))) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
  const [updated] = await db
    .update(b2bClientsTable)
    .set({ passwordHash: newHash, forcePasswordChange: false })
    .where(eq(b2bClientsTable.id, payload.id))
    .returning();

  const { storesTable } = await import("@workspace/db");
  const [store] = await db.select().from(storesTable).where(eq(storesTable.id, updated.storeId));

  const token = signToken({ id: updated.id, email: updated.email, role: "b2b_client", storeId: updated.storeId, b2bClientId: updated.id });
  res.json({
    token,
    user: {
      id: updated.id,
      email: updated.email,
      role: "b2b_client",
      storeId: updated.storeId,
      storeName: store?.name ?? null,
      storeSlug: store?.slug ?? null,
      companyName: updated.companyName,
      forcePasswordChange: false,
    },
  });
});

// ── Get Me ────────────────────────────────────────────────────────
router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const payload = verifyToken(authHeader.slice(7));
    res.json({ token: authHeader.slice(7), user: payload });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;

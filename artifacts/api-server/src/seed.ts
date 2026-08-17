/**
 * Seed script — creates demo data for the multi-brand platform.
 * Run: pnpm --filter @workspace/api-server run seed
 */
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  storesTable,
  usersTable,
  b2bClientsTable,
  productsTable,
  productVariantsTable,
  productImagesTable,
  productCategoriesTable,
  categoriesTable,
  b2bClientProductsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding database…");

  // ── Super Admin ──────────────────────────────────────────────────
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, "admin@platform.com"));
  if (existing.length === 0) {
    await db.insert(usersTable).values({
      email: "admin@platform.com",
      passwordHash: await bcrypt.hash("admin1234", 10),
      role: "super_admin",
    });
    console.log("✓ Super admin created: admin@platform.com / admin1234");
  } else {
    console.log("✓ Super admin already exists");
  }

  // ── Stores ───────────────────────────────────────────────────────
  const storeData = [
    {
      name: "Apex Athletics",
      slug: "apex-athletics",
      logoText: "APEX",
      announcementBar: "Free shipping on orders over $150 · Use code APEX10 for 10% off",
      primaryColor: "#0f172a",
      accentColor: "#f59e0b",
      fontFamily: "Inter",
      isActive: true,
      demoMode: true,
    },
    {
      name: "Lumière Luxe",
      slug: "lumiere-luxe",
      logoText: "LUMIÈRE",
      announcementBar: "New season collection now available · Complimentary gift wrapping",
      primaryColor: "#1c1917",
      accentColor: "#d4a574",
      fontFamily: "Playfair Display",
      isActive: true,
      demoMode: true,
    },
    {
      name: "Neon District",
      slug: "neon-district",
      logoText: "NEON",
      announcementBar: "Drop #7 is live — limited quantities. Shop now before it's gone.",
      primaryColor: "#09090b",
      accentColor: "#a855f7",
      fontFamily: "Space Grotesk",
      isActive: true,
      demoMode: true,
    },
    {
      name: "Terra Home",
      slug: "terra-home",
      logoText: "TERRA",
      announcementBar: "Sustainable materials · Carbon-neutral shipping · B-Corp certified",
      primaryColor: "#1a1a14",
      accentColor: "#84cc16",
      fontFamily: "Outfit",
      isActive: true,
      demoMode: true,
    },
  ];

  const stores: (typeof storesTable.$inferSelect)[] = [];
  for (const data of storeData) {
    const existing = await db.select().from(storesTable).where(eq(storesTable.slug, data.slug));
    if (existing.length > 0) {
      stores.push(existing[0]);
      console.log(`✓ Store "${data.name}" already exists`);
    } else {
      const [store] = await db.insert(storesTable).values(data as any).returning();
      stores.push(store);
      console.log(`✓ Store "${data.name}" created`);
    }
  }

  const [apex, lumiere, neon, terra] = stores;

  // ── Store Admins ─────────────────────────────────────────────────
  const adminData = [
    { email: "apex-admin@example.com", storeId: apex.id, storeName: apex.name },
    { email: "lumiere-admin@example.com", storeId: lumiere.id, storeName: lumiere.name },
    { email: "neon-admin@example.com", storeId: neon.id, storeName: neon.name },
    { email: "terra-admin@example.com", storeId: terra.id, storeName: terra.name },
  ];

  for (const adminInfo of adminData) {
    const existingAdmin = await db.select().from(usersTable).where(eq(usersTable.email, adminInfo.email));
    if (existingAdmin.length === 0) {
      await db.insert(usersTable).values({
        email: adminInfo.email,
        passwordHash: await bcrypt.hash("store1234", 10),
        role: "store_admin",
        storeId: adminInfo.storeId,
      });
      console.log(`✓ Store admin created: ${adminInfo.email} / store1234 (${adminInfo.storeName})`);
    }
  }

  // ── Categories for Apex Athletics ────────────────────────────────
  const apexCats = ["Apparel", "Footwear", "Equipment", "Accessories"];
  const catRecords: (typeof categoriesTable.$inferSelect)[] = [];
  for (let i = 0; i < apexCats.length; i++) {
    const existing = await db.select().from(categoriesTable).where(eq(categoriesTable.name, apexCats[i]));
    const matchingStore = existing.find((c) => c.storeId === apex.id);
    if (!matchingStore) {
      const [cat] = await db.insert(categoriesTable).values({ storeId: apex.id, name: apexCats[i], displayOrder: i }).returning();
      catRecords.push(cat);
    } else {
      catRecords.push(matchingStore);
    }
  }
  console.log("✓ Categories seeded for Apex Athletics");

  // ── Products for Apex Athletics ───────────────────────────────────
  const apexProductData = [
    {
      name: "Performance Training Tee",
      description: "Moisture-wicking technical fabric engineered for high-intensity training. Anti-odor treatment, 4-way stretch.",
      price: "49.99",
      compareAtPrice: "69.99",
      status: "active" as const,
      channel: "all" as const,
      preOrder: false,
    },
    {
      name: "Elite Running Short",
      description: "Lightweight 5\" inseam running short with compression liner, reflective details, and zippered back pocket.",
      price: "64.99",
      status: "active" as const,
      channel: "all" as const,
      preOrder: false,
    },
    {
      name: "Velocity Pro Sneaker",
      description: "Carbon-fiber plate running shoe with responsive foam midsole. Race-ready from 5K to marathon.",
      price: "189.99",
      compareAtPrice: "229.99",
      status: "active" as const,
      channel: "b2c" as const,
      preOrder: false,
    },
    {
      name: "Apex Kettlebell 20kg",
      description: "Competition-grade cast iron kettlebell with powder-coat finish and precise weight tolerances.",
      price: "89.99",
      status: "active" as const,
      channel: "b2b" as const,
      preOrder: true,
      preOrderNotice: "Pre-order now — ships in 4–6 weeks",
    },
    {
      name: "Pro Resistance Band Set",
      description: "Set of 5 latex resistance bands with door anchor, carrying bag, and exercise guide.",
      price: "34.99",
      status: "active" as const,
      channel: "all" as const,
      preOrder: false,
    },
  ];

  for (const pd of apexProductData) {
    const existing = await db.select().from(productsTable).where(eq(productsTable.name, pd.name));
    if (existing.some((p) => p.storeId === apex.id)) continue;

    const [product] = await db.insert(productsTable).values({ ...pd, storeId: apex.id }).returning();

    // Variants
    const colors = ["Black", "Navy", "Charcoal"];
    const sizes = ["S", "M", "L", "XL"];
    if (pd.name.includes("Tee") || pd.name.includes("Short")) {
      for (const color of colors) {
        for (const size of sizes) {
          await db.insert(productVariantsTable).values({
            productId: product.id,
            color,
            size,
            sku: `${pd.name.substring(0, 3).toUpperCase()}-${color.substring(0, 2).toUpperCase()}-${size}`,
            inventory: Math.floor(Math.random() * 50) + 10,
          });
        }
      }
    } else {
      await db.insert(productVariantsTable).values({
        productId: product.id,
        sku: `${pd.name.substring(0, 6).toUpperCase().replace(/\s/g, "")}-DEFAULT`,
        inventory: Math.floor(Math.random() * 30) + 5,
      });
    }

    // Images (using placeholder URLs)
    await db.insert(productImagesTable).values([
      { productId: product.id, url: `https://images.unsplash.com/photo-1571019613914-85f342c6a11e?w=600`, altText: `${pd.name} - main`, displayOrder: 0 },
      { productId: product.id, url: `https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600`, altText: `${pd.name} - detail`, displayOrder: 1 },
    ]);

    // Category (Apparel or Equipment)
    const catIndex = pd.name.includes("Sneaker") || pd.name.includes("Footwear") ? 1 : pd.name.includes("Kettlebell") || pd.name.includes("Band") ? 2 : 0;
    await db.insert(productCategoriesTable).values({ productId: product.id, categoryId: catRecords[catIndex].id });
  }
  console.log("✓ Products seeded for Apex Athletics");

  // ── B2B Clients ───────────────────────────────────────────────────
  const b2bData = [
    {
      email: "buyer@sportsgear-wholesale.com",
      companyName: "SportGear Wholesale Ltd",
      contactName: "Marcus Webb",
      phone: "+1 312 555 0142",
      discountPercent: "20",
      paymentTerms: "net30" as const,
      storeId: apex.id,
    },
    {
      email: "purchasing@fitchaingyms.com",
      companyName: "FitChain Gyms Inc",
      contactName: "Rachel Okonkwo",
      phone: "+1 773 555 0287",
      discountPercent: "15",
      paymentTerms: "cod" as const,
      storeId: apex.id,
    },
    {
      email: "orders@premiumboutiques.co",
      companyName: "Premium Boutiques Co",
      contactName: "Jean-Pierre Moreau",
      phone: "+1 212 555 0391",
      discountPercent: "25",
      paymentTerms: "net30" as const,
      storeId: lumiere.id,
    },
  ];

  const b2bClients: (typeof b2bClientsTable.$inferSelect)[] = [];
  for (const clientData of b2bData) {
    const existing = await db.select().from(b2bClientsTable).where(eq(b2bClientsTable.email, clientData.email));
    if (existing.length > 0) {
      b2bClients.push(existing[0]);
      console.log(`✓ B2B client already exists: ${clientData.email}`);
    } else {
      const [client] = await db.insert(b2bClientsTable).values({
        ...clientData,
        passwordHash: await bcrypt.hash("buyer1234", 10),
        forcePasswordChange: false,
        isActive: true,
      }).returning();
      b2bClients.push(client);
      console.log(`✓ B2B client created: ${clientData.email} / buyer1234`);
    }
  }

  // Assign all apex products to apex B2B clients
  const apexProducts = await db.select().from(productsTable).where(eq(productsTable.storeId, apex.id));
  for (const client of b2bClients.filter((c) => c.storeId === apex.id)) {
    for (const product of apexProducts) {
      const existing = await db.select().from(b2bClientProductsTable)
        .where(eq(b2bClientProductsTable.b2bClientId, client.id));
      if (!existing.some((r) => r.productId === product.id)) {
        await db.insert(b2bClientProductsTable).values({ b2bClientId: client.id, productId: product.id }).catch(() => {});
      }
    }
  }
  console.log("✓ B2B client product access assigned");

  console.log("\n✅ Seed complete!\n");
  console.log("Credentials:");
  console.log("  Super Admin: admin@platform.com / admin1234");
  console.log("  Store Admin (Apex): apex-admin@example.com / store1234");
  console.log("  Store Admin (Lumière): lumiere-admin@example.com / store1234");
  console.log("  Store Admin (Neon): neon-admin@example.com / store1234");
  console.log("  Store Admin (Terra): terra-admin@example.com / store1234");
  console.log("  B2B Buyer (Apex): buyer@sportsgear-wholesale.com / buyer1234");
  console.log("  B2B Buyer (Apex): purchasing@fitchaingyms.com / buyer1234");
  console.log("  B2B Buyer (Lumière): orders@premiumboutiques.co / buyer1234");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });

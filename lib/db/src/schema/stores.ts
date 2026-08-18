import { pgTable, text, serial, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const storesTable = pgTable("stores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoText: text("logo_text"),
  logoImageUrl: text("logo_image_url"),
  announcementBar: text("announcement_bar"),
  primaryColor: text("primary_color").notNull().default("#1a1a2e"),
  accentColor: text("accent_color").notNull().default("#e94560"),
  fontFamily: text("font_family").notNull().default("Inter"),
  isActive: boolean("is_active").notNull().default(true),
  demoMode: boolean("demo_mode").notNull().default(true),
  customDomain: text("custom_domain").unique(),
  shopifyDomain: text("shopify_domain"),
  shopifyStorefrontToken: text("shopify_storefront_token"),
  shopifyAdminKey: text("shopify_admin_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStoreSchema = createInsertSchema(storesTable).omit({ id: true, createdAt: true });
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type Store = typeof storesTable.$inferSelect;

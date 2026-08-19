import { pgTable, text, serial, boolean, timestamp, integer, numeric, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { isNotNull } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: numeric("compare_at_price", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("active"), // 'active' | 'disabled'
  channel: text("channel").notNull().default("all"), // 'all' | 'b2b' | 'b2c'
  preOrder: boolean("pre_order").notNull().default(false),
  preOrderNotice: text("pre_order_notice"),
  shopifyProductId: text("shopify_product_id"),
  shopifySynced: boolean("shopify_synced").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("products_store_shopify_product_unique")
    .on(table.storeId, table.shopifyProductId)
    .where(isNotNull(table.shopifyProductId)),
]);

export const productVariantsTable = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  color: text("color"),
  size: text("size"),
  sku: text("sku").notNull(),
  inventory: integer("inventory").notNull().default(0),
  price: numeric("price", { precision: 10, scale: 2 }),
  shopifyVariantId: text("shopify_variant_id"),
});

// Maps a Shopify collection to one or more platform stores.
// Products in that collection are synced into every mapped store.
export const shopifyCollectionStoreMappingsTable = pgTable("shopify_collection_store_mappings", {
  collectionId: text("collection_id").notNull(),
  storeId: integer("store_id").notNull(),
}, (table) => [primaryKey({ columns: [table.collectionId, table.storeId] })]);

export const productImagesTable = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  url: text("url").notNull(),
  altText: text("alt_text"),
  displayOrder: integer("display_order").notNull().default(0),
});

export const productCategoriesTable = pgTable("product_categories", {
  productId: integer("product_id").notNull(),
  categoryId: integer("category_id").notNull(),
}, (table) => [primaryKey({ columns: [table.productId, table.categoryId] })]);

export const b2bClientProductsTable = pgTable("b2b_client_products", {
  b2bClientId: integer("b2b_client_id").notNull(),
  productId: integer("product_id").notNull(),
}, (table) => [primaryKey({ columns: [table.b2bClientId, table.productId] })]);

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
export type ProductVariant = typeof productVariantsTable.$inferSelect;
export type ProductImage = typeof productImagesTable.$inferSelect;

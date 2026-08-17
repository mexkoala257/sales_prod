import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull(),
  type: text("type").notNull(), // 'b2b' | 'b2c'
  status: text("status").notNull().default("received"), // received | production | shipped | delivered
  fulfillmentStep: integer("fulfillment_step").notNull().default(1),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  paymentTerms: text("payment_terms").notNull(), // 'cod' | 'net30' | 'card'
  b2bClientId: integer("b2b_client_id"),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  shippingAddress: text("shipping_address"),
  notes: text("notes"),
  shopifyOrderId: text("shopify_order_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  variantId: integer("variant_id"),
  variantLabel: text("variant_label"),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
  artworkId: integer("artwork_id"),
  artworkName: text("artwork_name"),
  artworkUrl: text("artwork_url"),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;

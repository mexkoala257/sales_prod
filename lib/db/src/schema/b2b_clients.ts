import { pgTable, text, serial, boolean, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const b2bClientsTable = pgTable("b2b_clients", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name"),
  phone: text("phone"),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  paymentTerms: text("payment_terms").notNull().default("cod"), // 'cod' | 'net30'
  forcePasswordChange: boolean("force_password_change").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertB2BClientSchema = createInsertSchema(b2bClientsTable).omit({ id: true, createdAt: true });
export type InsertB2BClient = z.infer<typeof insertB2BClientSchema>;
export type B2BClient = typeof b2bClientsTable.$inferSelect;

import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const artworkTable = pgTable("artwork", {
  id: serial("id").primaryKey(),
  b2bClientId: integer("b2b_client_id").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(), // object storage path
  fileType: text("file_type").notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertArtworkSchema = createInsertSchema(artworkTable).omit({ id: true, uploadedAt: true });
export type InsertArtwork = z.infer<typeof insertArtworkSchema>;
export type Artwork = typeof artworkTable.$inferSelect;

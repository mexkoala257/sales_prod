import { pgTable, text, serial, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type StorefrontDiscoveryTile =
  | {
      id: string;
      type: "category";
      categoryId: number;
      sort?: never;
      label: string;
      visible: boolean;
    }
  | {
      id: string;
      type: "sort";
      categoryId?: never;
      sort: "featured" | "price-asc" | "price-desc" | "name";
      label: string;
      visible: boolean;
    };

export type HomepageLayout = "editorial" | "lookbook" | "collection_grid";

export type HomepageSections = {
  showDiscovery: boolean;
  showValues: boolean;
  showFeatured: boolean;
};

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
  heroEyebrow: text("hero_eyebrow"),
  heroTitle: text("hero_title"),
  heroSubtitle: text("hero_subtitle"),
  heroImageUrl: text("hero_image_url"),
  heroCtaLabel: text("hero_cta_label"),
  shopNavigationLabel: text("shop_navigation_label"),
  featuredSectionTitle: text("featured_section_title"),
  featuredSectionDescription: text("featured_section_description"),
  featuredProductLimit: integer("featured_product_limit").notNull().default(4),
  discoveryTiles: jsonb("discovery_tiles").$type<StorefrontDiscoveryTile[] | null>(),
  homepageLayout: text("homepage_layout").$type<HomepageLayout>().notNull().default("editorial"),
  homepageSections: jsonb("homepage_sections").$type<HomepageSections>().notNull().default({
    showDiscovery: true,
    showValues: true,
    showFeatured: true,
  }),
  buttonStyle: text("button_style").notNull().default("square"),
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

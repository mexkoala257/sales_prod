CREATE UNIQUE INDEX IF NOT EXISTS "products_store_shopify_product_unique"
  ON "products" ("store_id", "shopify_product_id")
  WHERE "shopify_product_id" IS NOT NULL;
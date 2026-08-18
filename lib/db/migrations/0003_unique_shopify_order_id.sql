-- Enforce webhook idempotency at the DB level: two concurrent orders/create
-- deliveries for the same Shopify order must not create duplicate rows.
-- Partial index: NULLs (non-Shopify orders) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS orders_shopify_order_id_unique
  ON orders (shopify_order_id)
  WHERE shopify_order_id IS NOT NULL;

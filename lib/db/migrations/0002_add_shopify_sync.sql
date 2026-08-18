-- Migration 0002: Shopify catalog sync & order push support
-- Idempotent — safe to run against a database that already has these objects.

ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS shopify_variant_id TEXT;

CREATE TABLE IF NOT EXISTS shopify_collection_store_mappings (
    collection_id TEXT    NOT NULL,
    store_id      INTEGER NOT NULL,
    PRIMARY KEY (collection_id, store_id)
);

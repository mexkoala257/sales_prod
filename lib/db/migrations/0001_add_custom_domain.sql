-- Migration 0001: Add custom_domain column to stores
-- Idempotent — safe to run against a database that already has the column/constraint.

ALTER TABLE stores ADD COLUMN IF NOT EXISTS custom_domain TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_custom_domain_unique'
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT stores_custom_domain_unique UNIQUE (custom_domain);
  END IF;
END
$$;

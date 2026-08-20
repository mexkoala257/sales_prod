ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "homepage_layout" TEXT NOT NULL DEFAULT 'editorial',
  ADD COLUMN IF NOT EXISTS "homepage_sections" JSONB NOT NULL DEFAULT '{"showDiscovery":true,"showValues":true,"showFeatured":true}'::jsonb;
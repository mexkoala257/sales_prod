ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "hero_eyebrow" TEXT,
  ADD COLUMN IF NOT EXISTS "hero_title" TEXT,
  ADD COLUMN IF NOT EXISTS "hero_subtitle" TEXT,
  ADD COLUMN IF NOT EXISTS "hero_image_url" TEXT,
  ADD COLUMN IF NOT EXISTS "hero_cta_label" TEXT,
  ADD COLUMN IF NOT EXISTS "shop_navigation_label" TEXT,
  ADD COLUMN IF NOT EXISTS "featured_section_title" TEXT,
  ADD COLUMN IF NOT EXISTS "featured_section_description" TEXT,
  ADD COLUMN IF NOT EXISTS "featured_product_limit" INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS "button_style" TEXT NOT NULL DEFAULT 'square';
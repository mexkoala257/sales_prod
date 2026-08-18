-- Migration 0000: Baseline schema
-- Creates all application tables for a fresh installation.
-- Idempotent — safe to run against an existing database (IF NOT EXISTS throughout).
-- The _migrations tracking table is created by the runner itself; it is excluded here.

-- ── Sequences ──────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.artwork_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.b2b_clients_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.categories_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.order_items_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.orders_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.product_images_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.product_variants_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.products_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.stores_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.users_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- ── Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stores (
    id            integer NOT NULL DEFAULT nextval('public.stores_id_seq'::regclass),
    name          text    NOT NULL,
    slug          text    NOT NULL,
    logo_text     text,
    logo_image_url text,
    announcement_bar text,
    primary_color text    NOT NULL DEFAULT '#1a1a2e',
    accent_color  text    NOT NULL DEFAULT '#e94560',
    font_family   text    NOT NULL DEFAULT 'Inter',
    is_active     boolean NOT NULL DEFAULT true,
    demo_mode     boolean NOT NULL DEFAULT true,
    shopify_domain text,
    shopify_storefront_token text,
    shopify_admin_key text,
    -- custom_domain is added by migration 0001_add_custom_domain.sql
    created_at    timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
    id            integer NOT NULL DEFAULT nextval('public.users_id_seq'::regclass),
    store_id      integer,         -- nullable: super_admins have no store affiliation
    email         text    NOT NULL,
    password_hash text    NOT NULL,
    role          text    NOT NULL DEFAULT 'store_admin',
    is_active     boolean NOT NULL DEFAULT true,
    created_at    timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.b2b_clients (
    id                    integer      NOT NULL DEFAULT nextval('public.b2b_clients_id_seq'::regclass),
    store_id              integer      NOT NULL,
    email                 text         NOT NULL,
    password_hash         text         NOT NULL,
    company_name          text         NOT NULL,
    contact_name          text,
    phone                 text,
    discount_percent      numeric(5,2) NOT NULL DEFAULT '0',
    payment_terms         text         NOT NULL DEFAULT 'cod',
    force_password_change boolean      NOT NULL DEFAULT true,
    is_active             boolean      NOT NULL DEFAULT true,
    created_at            timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
    id              integer NOT NULL DEFAULT nextval('public.categories_id_seq'::regclass),
    store_id        integer NOT NULL,
    name            text    NOT NULL,
    parent_id       integer,
    display_order   integer NOT NULL DEFAULT 0,
    banner_image_url text,
    created_at      timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
    id                   integer      NOT NULL DEFAULT nextval('public.products_id_seq'::regclass),
    store_id             integer      NOT NULL,
    name                 text         NOT NULL,
    description          text,
    price                numeric(10,2) NOT NULL,
    compare_at_price     numeric(10,2),
    status               text         NOT NULL DEFAULT 'active',
    channel              text         NOT NULL DEFAULT 'all',
    pre_order            boolean      NOT NULL DEFAULT false,
    pre_order_notice     text,
    shopify_product_id   text,
    shopify_synced       boolean      NOT NULL DEFAULT false,
    created_at           timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_images (
    id            integer NOT NULL DEFAULT nextval('public.product_images_id_seq'::regclass),
    product_id    integer NOT NULL,
    url           text    NOT NULL,
    alt_text      text,
    display_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.product_variants (
    id         integer      NOT NULL DEFAULT nextval('public.product_variants_id_seq'::regclass),
    product_id integer      NOT NULL,
    color      text,
    size       text,
    sku        text         NOT NULL,
    inventory  integer      NOT NULL DEFAULT 0,
    price      numeric(10,2)
);

CREATE TABLE IF NOT EXISTS public.product_categories (
    product_id  integer NOT NULL,
    category_id integer NOT NULL
);

CREATE TABLE IF NOT EXISTS public.b2b_client_products (
    b2b_client_id integer NOT NULL,
    product_id    integer NOT NULL
);

CREATE TABLE IF NOT EXISTS public.artwork (
    id            integer NOT NULL DEFAULT nextval('public.artwork_id_seq'::regclass),
    b2b_client_id integer NOT NULL,
    name          text    NOT NULL,
    url           text    NOT NULL,
    file_type     text    NOT NULL,
    file_size_bytes integer,
    uploaded_at   timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
    id               integer      NOT NULL DEFAULT nextval('public.orders_id_seq'::regclass),
    store_id         integer      NOT NULL,
    type             text         NOT NULL,
    status           text         NOT NULL DEFAULT 'received',
    fulfillment_step integer      NOT NULL DEFAULT 1,
    total            numeric(10,2) NOT NULL,
    payment_terms    text         NOT NULL,
    b2b_client_id    integer,
    customer_name    text,
    customer_email   text,
    shipping_address text,
    notes            text,
    shopify_order_id text,
    created_at       timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id           integer      NOT NULL DEFAULT nextval('public.order_items_id_seq'::regclass),
    order_id     integer      NOT NULL,
    product_id   integer      NOT NULL,
    product_name text         NOT NULL,
    variant_id   integer,
    variant_label text,
    quantity     integer      NOT NULL,
    unit_price   numeric(10,2) NOT NULL,
    line_total   numeric(10,2) NOT NULL,
    artwork_id   integer,
    artwork_name text,
    artwork_url  text
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
    key        text NOT NULL,
    value      text NOT NULL DEFAULT '',
    is_secret  boolean NOT NULL DEFAULT false,
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── Primary keys and unique constraints (idempotent via DO $$ guards) ──────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_pkey') THEN
    ALTER TABLE ONLY public.stores ADD CONSTRAINT stores_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_slug_unique') THEN
    ALTER TABLE ONLY public.stores ADD CONSTRAINT stores_slug_unique UNIQUE (slug);
  END IF;
END $$;

-- NOTE: stores_custom_domain_unique is added by migration 0001_add_custom_domain.sql

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_pkey') THEN
    ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique') THEN
    ALTER TABLE ONLY public.users ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'b2b_clients_pkey') THEN
    ALTER TABLE ONLY public.b2b_clients ADD CONSTRAINT b2b_clients_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_pkey') THEN
    ALTER TABLE ONLY public.categories ADD CONSTRAINT categories_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_pkey') THEN
    ALTER TABLE ONLY public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_images_pkey') THEN
    ALTER TABLE ONLY public.product_images ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_pkey') THEN
    ALTER TABLE ONLY public.product_variants ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_categories_product_id_category_id_pk') THEN
    ALTER TABLE ONLY public.product_categories
      ADD CONSTRAINT product_categories_product_id_category_id_pk PRIMARY KEY (product_id, category_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'b2b_client_products_b2b_client_id_product_id_pk') THEN
    ALTER TABLE ONLY public.b2b_client_products
      ADD CONSTRAINT b2b_client_products_b2b_client_id_product_id_pk PRIMARY KEY (b2b_client_id, product_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artwork_pkey') THEN
    ALTER TABLE ONLY public.artwork ADD CONSTRAINT artwork_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_pkey') THEN
    ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_pkey') THEN
    ALTER TABLE ONLY public.order_items ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_settings_pkey') THEN
    ALTER TABLE ONLY public.platform_settings ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (key);
  END IF;
END $$;

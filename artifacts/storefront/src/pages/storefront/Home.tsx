import { useGetStorefrontConfig, useListStorefrontCategories, useListStorefrontProducts } from '@workspace/api-client-react';
import { useParams, Link } from 'wouter';
import { Menu, Search, ShoppingBag, X, ArrowUpRight } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useStorefront } from '@/context/StorefrontContext';
import { useCartCount } from '@/lib/useCartCount';
import { StorefrontImage } from '@/components/storefront-image';

function useStorefrontEnabled() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/feature-flags')
      .then((r) => r.json())
      .then((flags: { featureB2CStorefront: boolean }) => setEnabled(flags?.featureB2CStorefront !== false))
      .catch(() => setEnabled(true));
  }, []);
  return enabled;
}

function productPrice(value: number) {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { storeSlug: paramSlug } = useParams();
  const { slug: contextSlug, isCustomDomain, resolving, storePath: ctxStorePath } = useStorefront();
  const storeSlug = isCustomDomain ? (contextSlug ?? '') : (paramSlug ?? '');
  const sp = (p: string) => ctxStorePath(p, storeSlug);
  const cartCount = useCartCount(storeSlug);
  const storefrontEnabled = useStorefrontEnabled();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: config, isLoading } = useGetStorefrontConfig(storeSlug, { query: { enabled: !!storeSlug && storefrontEnabled !== false } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: categories } = useListStorefrontCategories(storeSlug, { query: { enabled: !!storeSlug && storefrontEnabled !== false } as any });

  useEffect(() => {
    if (!config) return;
    const fontMap: Record<string, string> = {
      Inter: 'Inter, sans-serif',
      'Playfair Display': '"Playfair Display", Georgia, serif',
      Outfit: 'Outfit, sans-serif',
      'Space Grotesk': '"Space Grotesk", sans-serif',
    };
    document.documentElement.style.setProperty('--brand-primary', config.primaryColor);
    document.documentElement.style.setProperty('--brand-accent', config.accentColor);
    document.documentElement.style.setProperty('--brand-font', fontMap[config.fontFamily] || 'Inter, sans-serif');
    document.documentElement.style.setProperty('--brand-radius', config.buttonStyle === 'rounded' ? '9999px' : '0px');
    document.title = `${config.name} — ${config.shopNavigationLabel || 'Shop'}`;
    const description = config.heroSubtitle || `Shop the latest collection from ${config.name}.`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', description);
    return () => {
      ['--brand-primary', '--brand-accent', '--brand-font', '--brand-radius'].forEach((property) => document.documentElement.style.removeProperty(property));
    };
  }, [config]);

  if (resolving || storefrontEnabled === null || isLoading) {
    return <div className="min-h-screen grid place-items-center bg-stone-50 text-sm uppercase tracking-[0.18em] text-stone-500">Loading storefront</div>;
  }

  if (storefrontEnabled === false) {
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center p-6">
        <div className="max-w-sm space-y-5 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center border border-stone-900 text-lg font-semibold">SC</div>
          <h1 className="font-serif text-4xl tracking-tight">Coming soon</h1>
          <p className="text-sm leading-6 text-stone-500">This storefront is not currently available. Please check back later.</p>
          {!isCustomDomain && <Link href="/" className="text-xs font-medium uppercase tracking-[0.16em] underline underline-offset-4">Back to storefronts</Link>}
        </div>
      </div>
    );
  }

  if (!config) return <div className="min-h-screen grid place-items-center text-sm">Store not found.</div>;
  const shopLabel = config.shopNavigationLabel || 'Shop';
  const navigationCategories = categories?.slice(0, 3) || [];
  const promoMessage = config.announcementBar || 'Curated goods · Secure Shopify checkout';

  return (
    <div className="min-h-[100dvh] bg-[#fcfcfa] text-stone-900" style={{ fontFamily: 'var(--brand-font)' }}>
      <div className="bg-[var(--brand-primary)] px-4 py-2 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-white sm:text-[10px]">
        <span>{promoMessage}</span>
        <span className="mx-3 hidden opacity-60 sm:inline">•</span>
        <span className="hidden sm:inline">Independent stores, thoughtfully stocked</span>
      </div>
      <header className="sticky top-0 z-50 border-b border-stone-200/80 bg-[#fcfcfa]/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 md:px-8">
          <Link href={sp('/')} className="z-10 flex min-w-0 items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
            {config.logoImageUrl ? (
              <img src={config.logoImageUrl} alt={config.name} className="h-9 max-w-40 object-contain object-left" />
            ) : (
              <span className="truncate text-xl font-semibold tracking-[-0.05em] sm:text-2xl">{config.logoText || config.name}</span>
            )}
          </Link>
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 lg:flex">
            <Link href={sp('/products')} className="text-xs font-semibold uppercase tracking-[0.16em] transition-opacity hover:opacity-50">{shopLabel}</Link>
            {navigationCategories.map((category) => <a key={category.id} href={sp(`/products?category=${category.id}`)} className="text-xs font-medium uppercase tracking-[0.13em] text-stone-600 transition-colors hover:text-stone-950">{category.name}</a>)}
          </nav>
          <div className="flex items-center gap-1">
            <Link href={sp('/products?focus=search')} className="hidden h-10 items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors hover:bg-stone-100 sm:flex" aria-label="Search the catalog"><Search className="h-[17px] w-[17px]" strokeWidth={1.7} /><span className="hidden xl:inline">Search</span></Link>
            <Link href={sp('/cart')} className="relative grid h-10 w-10 place-items-center transition-colors hover:bg-stone-100" aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}>
              <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.7} />
              {cartCount > 0 && <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center bg-[var(--brand-primary)] px-1 text-[9px] font-bold text-white">{cartCount > 99 ? '99+' : cartCount}</span>}
            </Link>
            <button type="button" className="grid h-10 w-10 place-items-center md:hidden" onClick={() => setMobileMenuOpen((open) => !open)} aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <nav className="border-t border-stone-200 bg-[#fcfcfa] px-5 py-5 md:hidden">
            <div className="grid gap-4">
              <Link href={sp('/products')} onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium">{shopLabel}</Link>
              {navigationCategories.length > 0 && <div className="border-t border-stone-200 pt-4"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.17em] text-stone-400">Shop by category</p><div className="grid gap-3">{navigationCategories.map((category) => <a key={category.id} href={sp(`/products?category=${category.id}`)} onClick={() => setMobileMenuOpen(false)} className="text-sm text-stone-600">{category.name}</a>)}</div></div>}
            </div>
          </nav>
        )}
      </header>
      <main>{children}</main>
      <footer className="mt-16 border-t border-stone-200 bg-stone-100/50">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-10 text-xs text-stone-500 md:flex-row md:items-center md:justify-between md:px-8">
          <p className="font-medium text-stone-800">{config.logoText || config.name}</p>
          <p>© {new Date().getFullYear()} {config.name}. All rights reserved.</p>
          <Link href={sp('/products')} className="font-medium text-stone-800 underline underline-offset-4">{shopLabel}</Link>
        </div>
      </footer>
    </div>
  );
}

export default function StorefrontHome() {
  const { storeSlug: paramSlug } = useParams();
  const { slug: contextSlug, isCustomDomain, storePath: ctxStorePath } = useStorefront();
  const storeSlug = isCustomDomain ? (contextSlug ?? '') : (paramSlug ?? '');
  const sp = (p: string) => ctxStorePath(p, storeSlug);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: config } = useGetStorefrontConfig(storeSlug, { query: { enabled: !!storeSlug } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: products, isLoading } = useListStorefrontProducts(storeSlug, { query: { enabled: !!storeSlug } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: categories } = useListStorefrontCategories(storeSlug, { query: { enabled: !!storeSlug } as any });
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  useEffect(() => setHeroImageFailed(false), [config?.heroImageUrl]);
  const featuredLimit = Math.min(12, Math.max(1, config?.featuredProductLimit || 4));
  const heroTitle = config?.heroTitle || 'The pieces you reach for, on repeat.';
  const heroSubtitle = config?.heroSubtitle || 'Considered essentials and new favorites, curated for everyday rituals.';
  const shopLabel = config?.shopNavigationLabel || 'Shop';
  const categoryImage = (categoryId: number) => products?.find((product) => product.categories?.includes(categoryId))?.images?.[0];
  const configuredCategories = categories || [];
  const hasConfiguredCategories = configuredCategories.length > 0;
  const discoveryTiles = hasConfiguredCategories
    ? configuredCategories.slice(0, 6).map((category, index) => ({
        key: `category-${category.id}`,
        name: category.name,
        href: `/products?category=${category.id}`,
        image: categoryImage(category.id),
        tone: index % 3,
      }))
    : products?.length
      ? [
          { key: 'featured', name: 'Featured picks', href: '/products?sort=featured', image: products[0]?.images?.[0], tone: 0 },
          { key: 'starting-points', name: 'Starting points', href: '/products?sort=price-asc', image: products[1]?.images?.[0] || products[0]?.images?.[0], tone: 1 },
          { key: 'signature', name: 'Signature pieces', href: '/products?sort=price-desc', image: products[products.length - 1]?.images?.[0], tone: 2 },
        ]
      : [];

  return (
    <StorefrontLayout>
      <section className="mx-auto max-w-[1440px] px-0 md:px-4 md:pt-4">
        <div className="relative grid min-h-[620px] overflow-hidden bg-[var(--brand-accent)] md:min-h-[680px] md:grid-cols-[1.05fr_0.95fr]">
          <div className="relative z-10 flex items-end px-6 py-12 md:px-12 md:py-16">
            <div className="max-w-2xl">
              {config?.heroEyebrow && <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.22em] text-stone-700">{config.heroEyebrow}</p>}
              <h1 className="max-w-xl text-5xl font-semibold leading-[0.95] tracking-[-0.065em] text-stone-950 sm:text-6xl md:text-7xl lg:text-8xl">{heroTitle}</h1>
              <p className="mt-7 max-w-md text-base leading-7 text-stone-700 md:text-lg">{heroSubtitle}</p>
              <Link href={sp('/products')} className="storefront-button mt-9 inline-flex h-12 items-center gap-3 bg-[var(--brand-primary)] px-6 text-xs font-bold uppercase tracking-[0.15em] text-white transition-transform hover:-translate-y-0.5">
                {config?.heroCtaLabel || 'Shop the collection'} <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="relative min-h-[360px] bg-stone-300 md:min-h-0">
            {config?.heroImageUrl && !heroImageFailed ? (
              <img src={config.heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setHeroImageFailed(true)} />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_35%,rgba(255,255,255,0.7),transparent_0_32%),linear-gradient(135deg,rgba(255,255,255,0.2),rgba(0,0,0,0.11))]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-stone-900/20 via-transparent to-transparent" />
            <div className="absolute bottom-6 right-6 border border-white/70 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-white">Selected for now</div>
          </div>
        </div>
      </section>

      {discoveryTiles.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-5 pt-16 md:px-8 md:pt-24">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">{hasConfiguredCategories ? 'Find your favorite' : 'Start here'}</p><h2 className="text-3xl font-semibold tracking-[-0.045em] md:text-5xl">{hasConfiguredCategories ? 'Shop by category' : 'Explore the collection'}</h2></div>
            <Link href={sp('/products')} className="hidden text-xs font-bold uppercase tracking-[0.16em] underline underline-offset-8 sm:inline-flex">View everything</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {discoveryTiles.map((tile) => {
              return <a key={tile.key} href={sp(tile.href)} className="group relative aspect-square overflow-hidden bg-stone-200">
                <StorefrontImage src={tile.image?.url} alt={tile.image?.altText || tile.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]" fallbackClassName={`storefront-category-fallback storefront-category-fallback-${tile.tone}`} fallbackLabel={tile.name.slice(0, 2)} />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-4 text-white"><span className="text-sm font-medium">{tile.name}</span><ArrowUpRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" /></div>
              </a>;
            })}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1440px] px-5 pt-16 md:px-8 md:pt-24">
        <div className="grid border-y border-stone-200 md:grid-cols-3">
          {[['Made for togetherness', 'Thoughtful pieces for game nights, weekends, and everyday rituals.'], ['Choose with confidence', 'Clear product details, flexible options, and a simple shopping path.'], ['Shop your way', 'Discover by category, search the collection, and check out securely with Shopify.']].map(([title, description], index) => <div key={title} className={`px-0 py-7 md:px-8 md:py-9 ${index > 0 ? 'md:border-l md:border-stone-200' : ''}`}><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">0{index + 1}</p><h3 className="mt-4 text-xl font-semibold tracking-[-0.035em]">{title}</h3><p className="mt-3 max-w-xs text-sm leading-6 text-stone-500">{description}</p></div>)}
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-16 md:px-8 md:py-28">
        <div className="mb-10 grid gap-5 md:grid-cols-[1fr_auto] md:items-end md:gap-10">
          <div className="max-w-xl">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">The edit</p>
            <h2 className="text-3xl font-semibold tracking-[-0.045em] md:text-5xl">{config?.featuredSectionTitle || 'Featured arrivals'}</h2>
            {config?.featuredSectionDescription && <p className="mt-4 text-sm leading-6 text-stone-500 md:text-base">{config.featuredSectionDescription}</p>}
          </div>
          <Link href={sp('/products')} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] underline underline-offset-8">{shopLabel} all <ArrowUpRight className="h-4 w-4" /></Link>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-4 md:gap-x-6">
            {Array.from({ length: featuredLimit }).map((_, index) => <div key={index} className="space-y-3"><div className="storefront-skeleton aspect-[4/5]" /><div className="storefront-skeleton h-4 w-3/4" /><div className="storefront-skeleton h-3 w-1/3" /></div>)}
          </div>
        ) : products?.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-4 md:gap-x-6">
            {products.slice(0, featuredLimit).map((product) => (
              <Link key={product.id} href={sp(`/products/${product.id}`)} className="group block">
                <div className="relative mb-3 aspect-[4/5] overflow-hidden bg-stone-100">
                  <StorefrontImage src={product.images?.[0]?.url} alt={product.images?.[0]?.altText || product.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" />
                  {product.preOrder && <span className="absolute left-3 top-3 bg-white px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-stone-900">Pre-order</span>}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-medium leading-5">{product.name}</h3>
                  <span className="shrink-0 text-sm tabular-nums">{productPrice(product.price)}</span>
                </div>
                {product.compareAtPrice && product.compareAtPrice > product.price && <p className="mt-1 text-xs text-stone-400 line-through">{productPrice(product.compareAtPrice)}</p>}
              </Link>
            ))}
          </div>
        ) : (
          <div className="border-y border-stone-200 py-16 text-center">
            <p className="font-serif text-2xl">The collection is taking shape.</p>
            <p className="mt-2 text-sm text-stone-500">Check back soon for new arrivals.</p>
          </div>
        )}
      </section>
    </StorefrontLayout>
  );
}
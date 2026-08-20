import { useGetStorefrontConfig, useListStorefrontCategories, useListStorefrontProducts, type Product, type StorefrontDiscoveryTile } from '@workspace/api-client-react';
import { useParams, Link } from 'wouter';
import { Menu, Search, ShoppingBag, X, ArrowUpRight } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useStorefront } from '@/context/StorefrontContext';
import { useCartCount } from '@/lib/useCartCount';
import { StorefrontCollectionGrid, StorefrontEditorial, StorefrontLookbook } from '@/components/storefront-homepage-layouts';

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

type DiscoverySort = "featured" | "price-asc" | "price-desc" | "name";

function productForSort(products: Product[] | undefined, sort: DiscoverySort | undefined) {
  if (!products?.length) return undefined;
  if (sort === 'price-asc') return [...products].sort((a, b) => a.price - b.price)[0];
  if (sort === 'price-desc') return [...products].sort((a, b) => b.price - a.price)[0];
  if (sort === 'name') return [...products].sort((a, b) => a.name.localeCompare(b.name))[0];
  return products[0];
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
  const categoryImage = (categoryId: number) => products?.find((product) => product.categories?.includes(categoryId))?.images?.[0];
  const configuredCategories = categories || [];
  const hasConfiguredCategories = configuredCategories.length > 0;
  const fallbackDiscoveryTiles = hasConfiguredCategories
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
  const savedDiscoveryTiles = config?.discoveryTiles || [];
  const curatedDiscoveryTiles = savedDiscoveryTiles
    .filter((tile) => tile.visible)
    .map((tile, index) => {
      if (tile.type === 'category') {
        const category = configuredCategories.find((item) => item.id === tile.categoryId);
        if (!category) return null;
        return {
          key: tile.id,
          name: tile.label,
          href: `/products?category=${category.id}`,
          image: categoryImage(category.id),
          tone: index % 3,
        };
      }

      const product = productForSort(products, tile.sort);
      if (!tile.sort || !product) return null;
      return {
        key: tile.id,
        name: tile.label,
        href: `/products?sort=${tile.sort}`,
        image: product.images?.[0],
        tone: index % 3,
      };
    })
    .filter((tile): tile is NonNullable<typeof tile> => tile !== null);
  const hasSavedCuration = savedDiscoveryTiles.length > 0;
  const hasVisibleSavedTile = savedDiscoveryTiles.some((tile) => tile.visible);
  const useFallbackTiles = !hasSavedCuration || (hasVisibleSavedTile && curatedDiscoveryTiles.length === 0);
  const discoveryTiles = useFallbackTiles ? fallbackDiscoveryTiles : curatedDiscoveryTiles;
  const discoveryTitle = useFallbackTiles
    ? (hasConfiguredCategories ? 'Shop by category' : 'Explore the collection')
    : 'Curated for you';
  const discoveryEyebrow = useFallbackTiles
    ? (hasConfiguredCategories ? 'Find your favorite' : 'Start here')
    : 'Chosen for this edit';

  if (!config) {
    return <StorefrontLayout><div className="grid min-h-[60vh] place-items-center text-sm text-stone-500">Loading storefront</div></StorefrontLayout>;
  }

  const layoutProps = {
    config,
    products: products || [],
    isLoading,
    featuredLimit,
    discoveryTiles,
    discoveryTitle,
    discoveryEyebrow,
    heroImageFailed,
    onHeroImageError: () => setHeroImageFailed(true),
    storePath: sp,
  };

  return (
    <StorefrontLayout>
      {config.homepageLayout === 'lookbook' ? <StorefrontLookbook {...layoutProps} /> : config.homepageLayout === 'collection_grid' ? <StorefrontCollectionGrid {...layoutProps} /> : <StorefrontEditorial {...layoutProps} />}
    </StorefrontLayout>
  );
}
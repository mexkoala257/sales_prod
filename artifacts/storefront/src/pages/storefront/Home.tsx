import { useGetStorefrontConfig, useListStorefrontProducts } from '@workspace/api-client-react';
import { useParams, Link } from 'wouter';
import { ShoppingCart } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useStorefront } from '@/context/StorefrontContext';
import { useCartCount } from '@/lib/useCartCount';

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


export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { storeSlug: paramSlug } = useParams();
  const { slug: contextSlug, isCustomDomain, resolving, storePath: ctxStorePath } = useStorefront();

  // On custom domain: slug comes from domain resolution. On platform: slug comes from URL params.
  const storeSlug = isCustomDomain ? (contextSlug ?? '') : (paramSlug ?? '');

  // Convenience: build a store-relative path regardless of mode
  const sp = (p: string) => ctxStorePath(p, storeSlug);

  const cartCount = useCartCount(storeSlug);
  const storefrontEnabled = useStorefrontEnabled();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: config, isLoading } = useGetStorefrontConfig(storeSlug, {
    query: { enabled: !!storeSlug && storefrontEnabled !== false } as any,
  });

  useEffect(() => {
    if (config) {
      document.documentElement.style.setProperty('--brand-primary', config.primaryColor);
      document.documentElement.style.setProperty('--brand-accent', config.accentColor);
      const fontMap: Record<string, string> = {
        'Inter': 'Inter, sans-serif',
        'Playfair Display': '"Playfair Display", serif',
        'Outfit': 'Outfit, sans-serif',
        'Space Grotesk': '"Space Grotesk", sans-serif',
      };
      document.documentElement.style.setProperty('--brand-font', fontMap[config.fontFamily] || 'sans-serif');
    }
    return () => {
      document.documentElement.style.removeProperty('--brand-primary');
      document.documentElement.style.removeProperty('--brand-accent');
      document.documentElement.style.removeProperty('--brand-font');
    };
  }, [config]);

  if (resolving || storefrontEnabled === null || isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading Storefront...</div>;
  }

  if (storefrontEnabled === false) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-14 h-14 bg-zinc-900 text-white mx-auto flex items-center justify-center font-bold text-xl tracking-tighter">SC</div>
          <h1 className="text-2xl font-serif tracking-tight">Coming Soon</h1>
          <p className="text-zinc-500 text-sm">This storefront is not currently available. Please check back later.</p>
          {!isCustomDomain && (
            <Link href="/" className="text-xs font-mono uppercase tracking-widest text-zinc-400 hover:text-zinc-900 underline underline-offset-4">
              Back to storefronts
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (!config) return <div className="min-h-screen flex items-center justify-center">Store not found.</div>;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background" style={{ fontFamily: 'var(--brand-font)' }}>
      {config.announcementBar && (
        <div className="w-full py-2 text-center text-xs tracking-widest uppercase text-white font-medium" style={{ backgroundColor: 'var(--brand-primary)' }}>
          {config.announcementBar}
        </div>
      )}

      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={sp('/')} className="flex items-center gap-2">
            {config.logoImageUrl ? (
              <img src={config.logoImageUrl} alt={config.name} className="h-8 object-contain" />
            ) : (
              <span className="font-bold text-xl tracking-tight">{config.logoText || config.name}</span>
            )}
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link href={sp('/products')} className="text-sm font-medium hover:opacity-70 transition-opacity">Shop</Link>
            <a href="#" className="text-sm font-medium hover:opacity-70 transition-opacity">Collections</a>
            <a href="#" className="text-sm font-medium hover:opacity-70 transition-opacity">About</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href={sp('/cart')} className="relative p-2 hover:bg-accent rounded-full transition-colors">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: 'var(--brand-primary)' }}>
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t py-12 mt-12 bg-zinc-50">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-zinc-500">&copy; {new Date().getFullYear()} {config.name}. All rights reserved.</p>
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
  const { data: products } = useListStorefrontProducts(storeSlug, { query: { enabled: !!storeSlug } as any });

  return (
    <StorefrontLayout>
      <section className="w-full py-24 md:py-32 flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: 'var(--brand-accent)' }}>
        <div className="container px-4 md:px-6 relative z-10 text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter max-w-3xl mx-auto leading-tight">
            Curated Commerce. Redefined.
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto opacity-80">
            Explore our latest collection of premium products, designed for the modern lifestyle.
          </p>
          <div className="pt-4">
            <Link href={sp('/products')} className="inline-flex h-12 items-center justify-center px-8 text-sm font-medium text-white transition-opacity hover:opacity-90 uppercase tracking-widest" style={{ backgroundColor: 'var(--brand-primary)' }}>
              Shop Now
            </Link>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-2xl font-semibold tracking-tight">Featured Products</h2>
          <Link href={sp('/products')} className="text-sm underline underline-offset-4 hover:opacity-70">View all</Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {products?.slice(0, 4).map((product) => (
            <Link key={product.id} href={sp(`/products/${product.id}`)} className="group block">
              <div className="aspect-[4/5] bg-zinc-100 overflow-hidden mb-4 relative">
                {product.images?.[0] ? (
                  <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-300 font-mono text-sm">No Image</div>
                )}
                {product.preOrder && (
                  <div className="absolute top-3 left-3 bg-white px-3 py-1.5 text-[10px] uppercase font-bold tracking-widest">Pre-Order</div>
                )}
              </div>
              <div className="space-y-1">
                <h3 className="font-medium text-sm">{product.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">${product.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  {product.compareAtPrice && product.compareAtPrice > product.price && (
                    <span className="font-mono text-xs text-muted-foreground line-through">${product.compareAtPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </StorefrontLayout>
  );
}

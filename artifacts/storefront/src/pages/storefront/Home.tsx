import { useGetStorefrontConfig, useListStorefrontProducts } from '@workspace/api-client-react';
import { useParams, Link } from 'wouter';
import { ShoppingCart } from 'lucide-react';
import React, { useEffect } from 'react';

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { storeSlug } = useParams();
  const { data: config, isLoading } = useGetStorefrontConfig(storeSlug || '', { query: { enabled: !!storeSlug } });

  // Inject dynamic variables into the DOM
  useEffect(() => {
    if (config) {
      document.documentElement.style.setProperty('--brand-primary', config.primaryColor);
      document.documentElement.style.setProperty('--brand-accent', config.accentColor);
      // For fonts, we'll map the name to a CSS variable value
      const fontMap: Record<string, string> = {
        'Inter': 'Inter, sans-serif',
        'Playfair Display': '"Playfair Display", serif',
        'Outfit': 'Outfit, sans-serif',
        'Space Grotesk': '"Space Grotesk", sans-serif'
      };
      document.documentElement.style.setProperty('--brand-font', fontMap[config.fontFamily] || 'sans-serif');
    }
    return () => {
      document.documentElement.style.removeProperty('--brand-primary');
      document.documentElement.style.removeProperty('--brand-accent');
      document.documentElement.style.removeProperty('--brand-font');
    };
  }, [config]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading Storefront...</div>;
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
          <Link href={`/store/${config.slug}`} className="flex items-center gap-2">
            {config.logoImageUrl ? (
              <img src={config.logoImageUrl} alt={config.name} className="h-8 object-contain" />
            ) : (
              <span className="font-bold text-xl tracking-tight">{config.logoText || config.name}</span>
            )}
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link href={`/store/${config.slug}/products`} className="text-sm font-medium hover:opacity-70 transition-opacity">Shop</Link>
            <a href="#" className="text-sm font-medium hover:opacity-70 transition-opacity">Collections</a>
            <a href="#" className="text-sm font-medium hover:opacity-70 transition-opacity">About</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href={`/store/${config.slug}/cart`} className="relative p-2 hover:bg-accent rounded-full transition-colors">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: 'var(--brand-primary)' }}>0</span>
            </Link>
          </div>
        </div>
      </header>
      
      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t py-12 mt-12 bg-zinc-50">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-zinc-500">&copy; {new Date().getFullYear()} {config.name}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default function StorefrontHome() {
  const { storeSlug } = useParams();
  const { data: products } = useListStorefrontProducts(storeSlug || '', { query: { enabled: !!storeSlug } });

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
            <Link href={`/store/${storeSlug}/products`} className="inline-flex h-12 items-center justify-center px-8 text-sm font-medium text-white transition-opacity hover:opacity-90 uppercase tracking-widest" style={{ backgroundColor: 'var(--brand-primary)' }}>
              Shop Now
            </Link>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-2xl font-semibold tracking-tight">Featured Products</h2>
          <Link href={`/store/${storeSlug}/products`} className="text-sm underline underline-offset-4 hover:opacity-70">View all</Link>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {products?.slice(0, 4).map(product => (
            <Link key={product.id} href={`/store/${storeSlug}/products/${product.id}`} className="group block">
              <div className="aspect-[4/5] bg-zinc-100 overflow-hidden mb-4 relative">
                {product.images?.[0] ? (
                  <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-300 font-mono text-sm">No Image</div>
                )}
                {product.preOrder && (
                  <div className="absolute top-3 left-3 bg-white px-3 py-1.5 text-[10px] uppercase font-bold tracking-widest">
                    Pre-Order
                  </div>
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

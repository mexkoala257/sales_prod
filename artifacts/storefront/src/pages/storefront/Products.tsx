import { StorefrontLayout } from './Home';
import { useListStorefrontProducts } from '@workspace/api-client-react';
import { useParams, Link } from 'wouter';
import { useStorefront } from '@/context/StorefrontContext';

export default function StorefrontProducts() {
  const { storeSlug: paramSlug } = useParams();
  const { slug: contextSlug, isCustomDomain, storePath: ctxStorePath } = useStorefront();
  const storeSlug = isCustomDomain ? (contextSlug ?? '') : (paramSlug ?? '');
  const sp = (p: string) => ctxStorePath(p, storeSlug);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: products, isLoading } = useListStorefrontProducts(storeSlug, { query: { enabled: !!storeSlug } as any });

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-12 md:py-24">
        <div className="flex flex-col md:flex-row items-baseline justify-between mb-12 border-b pb-4">
          <h1 className="text-3xl font-bold tracking-tight">All Products</h1>
          <span className="text-muted-foreground text-sm font-mono mt-4 md:mt-0">{products?.length || 0} results</span>
        </div>

        <div className="flex flex-col md:flex-row gap-12">
          <aside className="w-full md:w-64 shrink-0 space-y-8">
            <div>
              <h3 className="font-semibold text-sm uppercase tracking-widest mb-4">Categories</h3>
              <ul className="space-y-3 text-sm text-zinc-600">
                <li><a href="#" className="hover:text-zinc-900 transition-colors">All Shop</a></li>
                <li><a href="#" className="hover:text-zinc-900 transition-colors">New Arrivals</a></li>
                <li><a href="#" className="hover:text-zinc-900 transition-colors">Best Sellers</a></li>
              </ul>
            </div>
          </aside>

          <div className="flex-1">
            {isLoading ? (
              <div className="animate-pulse flex gap-8 flex-wrap">
                {[1, 2, 3, 4].map((i) => <div key={i} className="w-64 h-96 bg-zinc-100" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {products?.map((product) => (
                  <Link key={product.id} href={sp(`/products/${product.id}`)} className="group block">
                    <div className="aspect-[4/5] bg-zinc-100 overflow-hidden mb-4 relative">
                      {product.images?.[0] ? (
                        <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-300 font-mono text-sm">No Image</div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-medium text-sm">{product.name}</h3>
                      <div className="font-mono text-sm text-zinc-500">${product.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {products?.length === 0 && (
              <div className="py-24 text-center text-muted-foreground border bg-zinc-50">
                No products found in this collection.
              </div>
            )}
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}

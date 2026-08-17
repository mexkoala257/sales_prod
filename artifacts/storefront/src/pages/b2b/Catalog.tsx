import { useGetB2BCatalog } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui';

export default function B2BCatalog() {
  const { data: catalog, isLoading } = useGetB2BCatalog();

  if (isLoading) return <div className="animate-pulse">Loading assigned catalog...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif tracking-tight">Wholesale Catalog</h1>
        <p className="text-muted-foreground mt-1">Your approved procurement list.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {catalog?.map((product) => (
          <Card key={product.id} className="rounded-none overflow-hidden hover:border-zinc-400 transition-colors cursor-pointer group">
            <div className="aspect-square bg-zinc-100 overflow-hidden relative">
              {product.images?.[0] ? (
                <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-300 font-mono text-sm">No Image</div>
              )}
              {product.preOrder && (
                <div className="absolute top-2 left-2 bg-white px-2 py-1 text-[10px] uppercase font-bold tracking-wider shadow-sm">
                  Pre-Order
                </div>
              )}
            </div>
            <CardContent className="p-4 space-y-1 bg-white">
              <h3 className="font-semibold text-sm truncate">{product.name}</h3>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-lg">${product.wholesalePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span className="font-mono text-xs text-muted-foreground line-through">${product.price.toLocaleString(undefined, { minimumFractionDigits: 2 })} MSRP</span>
              </div>
              <div className="text-xs text-muted-foreground mt-2 font-mono">
                {product.variants.length} variant{product.variants.length !== 1 ? 's' : ''} available
              </div>
            </CardContent>
          </Card>
        ))}
        {catalog?.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground border bg-white">
            No products are currently assigned to your catalog tier.
          </div>
        )}
      </div>
    </div>
  );
}

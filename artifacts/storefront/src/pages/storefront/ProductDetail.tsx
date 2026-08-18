import { useGetStorefrontProduct } from '@workspace/api-client-react';
import { useParams } from 'wouter';
import { StorefrontLayout } from './Home';
import { Button } from '@/components/ui';
import { useState } from 'react';
import { useStorefront } from '@/context/StorefrontContext';
import { addToCart } from '@/lib/cart';
import { useToast } from '@/hooks/use-toast';

export default function StorefrontProductDetail() {
  const { storeSlug: paramSlug, productId } = useParams();
  const { slug: contextSlug, isCustomDomain } = useStorefront();
  const storeSlug = isCustomDomain ? (contextSlug ?? '') : (paramSlug ?? '');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: product, isLoading } = useGetStorefrontProduct(storeSlug, productId || '', {
    query: { enabled: !!storeSlug && !!productId } as any,
  });

  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const { toast } = useToast();

  if (isLoading) return <StorefrontLayout><div className="py-24 text-center animate-pulse">Loading product...</div></StorefrontLayout>;
  if (!product) return <StorefrontLayout><div className="py-24 text-center">Product not found.</div></StorefrontLayout>;

  if (selectedVariant === null && product.variants && product.variants.length > 0) {
    setSelectedVariant(product.variants[0].id);
  }

  const currentVariant = product.variants?.find((v: any) => v.id === selectedVariant);
  // Variant price can be explicitly null (meaning "inherit from product") — always fall back to product.price
  const variantPrice = currentVariant?.price;
  const displayPrice: number = (variantPrice !== null && variantPrice !== undefined) ? variantPrice : product.price;
  const primaryImage = product.images?.[0]?.url;

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-12 md:py-24 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24">
          {/* Image */}
          <div className="aspect-[4/5] bg-zinc-100 overflow-hidden">
            {primaryImage ? (
              <img src={primaryImage} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-300 font-mono text-sm">No Image</div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6 pt-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
              <div className="flex items-baseline gap-3 mt-3">
                <span className="text-2xl font-mono">${(displayPrice as number).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                {product.compareAtPrice && product.compareAtPrice > product.price && (
                  <span className="text-lg font-mono text-muted-foreground line-through">${product.compareAtPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                )}
              </div>
            </div>

            {product.description && (
              <p className="text-muted-foreground leading-relaxed">{product.description}</p>
            )}

            {product.variants && product.variants.length > 1 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-widest">Options</p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v: any) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v.id)}
                      className={`px-4 py-2 text-sm border transition-colors ${
                        selectedVariant === v.id
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-300 hover:border-zinc-500'
                      }`}
                    >
                      {[v.color, v.size].filter(Boolean).join(' / ')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.preOrder && (
              <div className="inline-block bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 text-xs uppercase font-bold tracking-widest">
                Pre-Order
              </div>
            )}

            <Button
              className="w-full h-14 rounded-none uppercase tracking-widest text-sm"
              style={{ backgroundColor: 'var(--brand-primary)', color: 'white' }}
              onClick={() => {
                addToCart(storeSlug, {
                  productId: product.id,
                  variantId: currentVariant?.id ?? null,
                  name: product.name,
                  variantLabel: currentVariant ? [currentVariant.color, currentVariant.size].filter(Boolean).join(' / ') || null : null,
                  unitPrice: displayPrice,
                  imageUrl: primaryImage ?? null,
                });
                toast({ title: 'Added to cart', description: product.name });
              }}
            >
              Add to Cart
            </Button>
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}

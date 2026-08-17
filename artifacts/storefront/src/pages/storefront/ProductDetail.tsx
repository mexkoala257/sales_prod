import { useGetStorefrontProduct } from '@workspace/api-client-react';
import { useParams } from 'wouter';
import { StorefrontLayout } from './Home';
import { Button } from '@/components/ui';
import { useState } from 'react';

export default function StorefrontProductDetail() {
  const { storeSlug, productId } = useParams();
  const { data: product, isLoading } = useGetStorefrontProduct(storeSlug || '', productId || '', { query: { enabled: !!storeSlug && !!productId } });

  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);

  if (isLoading) return <StorefrontLayout><div className="py-24 text-center animate-pulse">Loading product...</div></StorefrontLayout>;
  if (!product) return <StorefrontLayout><div className="py-24 text-center">Product not found.</div></StorefrontLayout>;

  // Initialize selected variant
  if (selectedVariant === null && product.variants && product.variants.length > 0) {
    setSelectedVariant(product.variants[0].id);
  }

  const currentVariant = product.variants?.find(v => v.id === selectedVariant) || product.variants?.[0];
  const price = currentVariant?.price || product.price;

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-12 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24">
          
          <div className="space-y-4">
            <div className="aspect-[4/5] bg-zinc-100 relative">
              {product.images?.[0] ? (
                 <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                 <div className="w-full h-full flex items-center justify-center text-zinc-300 font-mono">No Image</div>
              )}
            </div>
            {product.images && product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {product.images.slice(1).map(img => (
                  <div key={img.id} className="aspect-square bg-zinc-100 cursor-pointer">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-8">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{product.name}</h1>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-mono">${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                {product.compareAtPrice && product.compareAtPrice > price && (
                  <span className="text-lg font-mono text-muted-foreground line-through">${product.compareAtPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                )}
              </div>
            </div>

            {product.preOrder && (
              <div className="bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 font-medium">
                PRE-ORDER ITEM — {product.preOrderNotice || 'Ships at a later date.'}
              </div>
            )}

            {product.variants && product.variants.length > 1 && (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2 uppercase tracking-widest text-muted-foreground">Select Variant</div>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map(variant => (
                      <button 
                        key={variant.id}
                        onClick={() => setSelectedVariant(variant.id)}
                        className={`px-4 py-2 text-sm border font-mono transition-colors ${selectedVariant === variant.id ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-zinc-400'}`}
                      >
                        {variant.color} {variant.size ? `/ ${variant.size}` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <Button 
              className="w-full h-14 rounded-none text-white uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity" 
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              Add to Cart
            </Button>

            <div className="pt-8 border-t space-y-4">
              <h3 className="font-semibold tracking-tight">Product Details</h3>
              <p className="text-zinc-600 leading-relaxed text-sm">
                {product.description || 'No description available for this product.'}
              </p>
            </div>
          </div>

        </div>
      </div>
    </StorefrontLayout>
  );
}

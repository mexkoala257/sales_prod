import { useGetStorefrontProduct } from '@workspace/api-client-react';
import { useParams, Link } from 'wouter';
import { StorefrontLayout } from './Home';
import { Button } from '@/components/ui';
import { useEffect, useState } from 'react';
import { ChevronLeft, ShoppingBag } from 'lucide-react';
import { useStorefront } from '@/context/StorefrontContext';
import { addToCart } from '@/lib/cart';
import { useToast } from '@/hooks/use-toast';
import { StorefrontImage } from '@/components/storefront-image';

export default function StorefrontProductDetail() {
  const { storeSlug: paramSlug, productId } = useParams();
  const { slug: contextSlug, isCustomDomain, storePath } = useStorefront();
  const storeSlug = isCustomDomain ? (contextSlug ?? '') : (paramSlug ?? '');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: product, isLoading } = useGetStorefrontProduct(storeSlug, productId || '', { query: { enabled: !!storeSlug && !!productId } as any });
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const { toast } = useToast();
  useEffect(() => { if (product?.variants?.length) setSelectedVariant(product.variants[0].id); }, [product?.id]);
  if (isLoading) return <StorefrontLayout><div className="mx-auto max-w-[1440px] px-5 py-16 md:px-8"><div className="grid gap-10 md:grid-cols-2"><div className="storefront-skeleton aspect-[4/5]" /><div className="space-y-5"><div className="storefront-skeleton h-12 w-3/4" /><div className="storefront-skeleton h-5 w-1/4" /><div className="storefront-skeleton h-24 w-full" /></div></div></div></StorefrontLayout>;
  if (!product) return <StorefrontLayout><div className="grid min-h-[55vh] place-items-center px-5 text-center"><div><p className="font-serif text-3xl">This piece is no longer available.</p><Link href={storePath('/products', storeSlug)} className="mt-5 inline-block text-xs font-bold uppercase tracking-[0.16em] underline underline-offset-4">Return to the shop</Link></div></div></StorefrontLayout>;
  const images = product.images || [];
  const activeImage = images[selectedImageIndex]?.url || images[0]?.url;
  const currentVariant = product.variants?.find((variant) => variant.id === selectedVariant);
  const displayPrice = currentVariant?.price ?? product.price;
  const formatPrice = (price: number) => price.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  return (
    <StorefrontLayout>
      <div className="mx-auto max-w-[1440px] px-5 py-7 md:px-8 md:py-10"><Link href={storePath('/products', storeSlug)} className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.17em] text-stone-500 hover:text-stone-900"><ChevronLeft className="h-4 w-4" /> Back to shop</Link></div>
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 pb-16 md:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.7fr)] md:gap-16 md:px-8 lg:gap-24">
        <section className="space-y-3">
          <div className="aspect-[4/5] overflow-hidden bg-stone-100"><StorefrontImage src={activeImage} alt={images[selectedImageIndex]?.altText || product.name} fallbackLabel="No image available" /></div>
          {images.length > 1 && <div className="grid grid-cols-5 gap-2">{images.map((image, index) => <button key={image.id} type="button" onClick={() => setSelectedImageIndex(index)} className={`aspect-square overflow-hidden border ${selectedImageIndex === index ? 'border-stone-950' : 'border-transparent'}`} aria-label={`View product image ${index + 1}`}><StorefrontImage src={image.url} alt="" fallbackLabel="No image" /></button>)}</div>}
        </section>
        <aside className="md:sticky md:top-28 md:self-start">
          <div className="border-b border-stone-200 pb-7"><div className="flex items-start justify-between gap-5"><h1 className="text-4xl font-semibold leading-[0.98] tracking-[-0.06em] md:text-5xl">{product.name}</h1>{product.preOrder && <span className="shrink-0 border border-amber-300 bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-900">Pre-order</span>}</div><div className="mt-5 flex items-baseline gap-3"><span className="text-lg tabular-nums">{formatPrice(displayPrice)}</span>{product.compareAtPrice && product.compareAtPrice > displayPrice && <span className="text-sm text-stone-400 line-through">{formatPrice(product.compareAtPrice)}</span>}</div></div>
          {product.description && <p className="border-b border-stone-200 py-7 text-sm leading-7 text-stone-600">{product.description}</p>}
          {product.variants && product.variants.length > 1 && <div className="border-b border-stone-200 py-7"><p className="mb-4 text-[10px] font-bold uppercase tracking-[0.17em]">Choose an option</p><div className="flex flex-wrap gap-2">{product.variants.map((variant) => <button type="button" key={variant.id} onClick={() => setSelectedVariant(variant.id)} className={`min-h-10 border px-4 text-xs font-medium transition-colors ${selectedVariant === variant.id ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white' : 'border-stone-300 hover:border-stone-900'}`}>{[variant.color, variant.size].filter(Boolean).join(' / ') || variant.sku}</button>)}</div></div>}
          <Button className="storefront-button mt-7 h-14 w-full gap-3 bg-[var(--brand-primary)] text-xs font-bold uppercase tracking-[0.16em] text-white hover:opacity-90" onClick={() => { addToCart(storeSlug, { productId: product.id, variantId: currentVariant?.id ?? null, name: product.name, variantLabel: currentVariant ? [currentVariant.color, currentVariant.size].filter(Boolean).join(' / ') || null : null, unitPrice: displayPrice, imageUrl: activeImage ?? null }); toast({ title: 'Added to cart', description: product.name }); }}><ShoppingBag className="h-4 w-4" /> Add to bag</Button>
          <p className="mt-4 text-center text-xs leading-5 text-stone-500">Secure checkout is completed with Shopify.</p>
        </aside>
      </div>
    </StorefrontLayout>
  );
}
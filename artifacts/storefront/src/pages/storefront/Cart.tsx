import { StorefrontLayout } from './Home';
import { useParams, Link } from 'wouter';
import { Button } from '@/components/ui';
import { ShoppingBag, Minus, Plus, Trash2, ArrowRight } from 'lucide-react';
import { useStorefront } from '@/context/StorefrontContext';
import { useEffect, useState } from 'react';
import { getCart, updateQuantity, cartTotal, type CartItem } from '@/lib/cart';
import { useCreateShopifyCheckout } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { StorefrontImage } from '@/components/storefront-image';

export default function StorefrontCart() {
  const { storeSlug: paramSlug } = useParams();
  const { slug: contextSlug, isCustomDomain, storePath: ctxStorePath } = useStorefront();
  const storeSlug = isCustomDomain ? (contextSlug ?? '') : (paramSlug ?? '');
  const sp = (path: string) => ctxStorePath(path, storeSlug);
  const { toast } = useToast();
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    if (!storeSlug) return;
    const refresh = () => setItems(getCart(storeSlug));
    refresh();
    window.addEventListener('cart-updated', refresh);
    return () => window.removeEventListener('cart-updated', refresh);
  }, [storeSlug]);
  const checkout = useCreateShopifyCheckout();
  const handleCheckout = async () => {
    try {
      const result = await checkout.mutateAsync({ storeSlug, data: { items: items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })) } });
      window.location.href = result.checkoutUrl;
    } catch (error: unknown) {
      toast({ title: 'Checkout unavailable', description: (error as Error)?.message || 'Could not start checkout. Please try again.', variant: 'destructive' });
    }
  };
  const total = cartTotal(items);
  const money = (value: number) => value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  return (
    <StorefrontLayout>
      <div className="mx-auto max-w-[1280px] px-5 py-12 md:px-8 md:py-16">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">Your selection</p>
        <h1 className="text-5xl font-semibold tracking-[-0.06em] md:text-7xl">Shopping bag</h1>
        {items.length === 0 ? (
          <div className="mt-12 grid min-h-[390px] place-items-center border-y border-stone-200 text-center">
            <div><div className="mx-auto grid h-16 w-16 place-items-center border border-stone-300"><ShoppingBag className="h-6 w-6" strokeWidth={1.4} /></div><h2 className="mt-6 font-serif text-3xl">Your bag is waiting.</h2><p className="mt-3 text-sm text-stone-500">Find the pieces that feel like yours.</p><Link href={sp('/products')} className="storefront-button mt-8 inline-flex h-12 items-center gap-3 bg-[var(--brand-primary)] px-6 text-xs font-bold uppercase tracking-[0.16em] text-white">Continue shopping <ArrowRight className="h-4 w-4" /></Link></div>
          </div>
        ) : (
          <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_350px]">
            <div className="border-t border-stone-200">
              {items.map((item) => (
                <div key={`${item.productId}-${item.variantId}`} className="grid grid-cols-[92px_minmax(0,1fr)_auto] gap-4 border-b border-stone-200 py-5 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:gap-6">
                  <div className="aspect-[4/5] overflow-hidden bg-stone-100"><StorefrontImage src={item.imageUrl} alt={item.name} /></div>
                  <div className="min-w-0"><p className="text-base font-medium leading-5">{item.name}</p>{item.variantLabel && <p className="mt-1 text-sm text-stone-500">{item.variantLabel}</p>}<p className="mt-3 text-sm tabular-nums">{money(item.unitPrice)}</p><div className="mt-5 inline-flex h-9 items-center border border-stone-300"><button type="button" className="grid h-full w-9 place-items-center transition hover:bg-stone-100" onClick={() => updateQuantity(storeSlug, item.productId, item.variantId, item.quantity - 1)} aria-label={`Decrease quantity of ${item.name}`}><Minus className="h-3.5 w-3.5" /></button><span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span><button type="button" className="grid h-full w-9 place-items-center transition hover:bg-stone-100" onClick={() => updateQuantity(storeSlug, item.productId, item.variantId, item.quantity + 1)} aria-label={`Increase quantity of ${item.name}`}><Plus className="h-3.5 w-3.5" /></button></div></div>
                  <div className="flex flex-col items-end justify-between"><button type="button" onClick={() => updateQuantity(storeSlug, item.productId, item.variantId, 0)} className="p-1 text-stone-400 transition hover:text-stone-950" aria-label={`Remove ${item.name}`}><Trash2 className="h-4 w-4" /></button><p className="text-sm font-medium tabular-nums">{money(item.unitPrice * item.quantity)}</p></div>
                </div>
              ))}
            </div>
            <aside className="h-fit border border-stone-200 bg-stone-50 p-6 lg:sticky lg:top-28">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Order summary</p>
              <div className="mt-7 space-y-3 border-b border-stone-200 pb-6 text-sm"><div className="flex justify-between"><span className="text-stone-500">Subtotal</span><span className="tabular-nums">{money(total)}</span></div><div className="flex justify-between"><span className="text-stone-500">Shipping</span><span className="text-stone-500">Calculated at checkout</span></div></div>
              <div className="flex items-baseline justify-between pt-6"><span className="text-sm font-medium">Estimated total</span><span className="text-2xl font-medium tracking-[-0.04em] tabular-nums">{money(total)}</span></div>
              <Button className="storefront-button mt-7 h-13 w-full bg-[var(--brand-primary)] text-xs font-bold uppercase tracking-[0.16em] text-white hover:opacity-90" onClick={handleCheckout} disabled={checkout.isPending}>{checkout.isPending ? 'Opening secure checkout…' : 'Secure checkout'}</Button>
              <p className="mt-4 text-center text-xs leading-5 text-stone-500">You’ll complete payment safely with Shopify.</p>
            </aside>
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
}
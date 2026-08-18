import { StorefrontLayout } from './Home';
import { useParams } from 'wouter';
import { Button } from '@/components/ui';
import { ShoppingCart, Minus, Plus, Trash2 } from 'lucide-react';
import { useStorefront } from '@/context/StorefrontContext';
import { useEffect, useState } from 'react';
import { getCart, updateQuantity, cartTotal, type CartItem } from '@/lib/cart';
import { useCreateShopifyCheckout } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';

export default function StorefrontCart() {
  const { storeSlug: paramSlug } = useParams();
  const { slug: contextSlug, isCustomDomain, storePath: ctxStorePath } = useStorefront();
  const storeSlug = isCustomDomain ? (contextSlug ?? '') : (paramSlug ?? '');
  const sp = (p: string) => ctxStorePath(p, storeSlug);
  const { toast } = useToast();

  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    if (!storeSlug) return;
    setItems(getCart(storeSlug));
    const onUpdate = () => setItems(getCart(storeSlug));
    window.addEventListener('cart-updated', onUpdate);
    return () => window.removeEventListener('cart-updated', onUpdate);
  }, [storeSlug]);

  const checkout = useCreateShopifyCheckout();

  const handleCheckout = async () => {
    try {
      const result = await checkout.mutateAsync({
        storeSlug,
        data: { items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })) },
      });
      // Hand off to Shopify's hosted checkout — payment happens there.
      window.location.href = result.checkoutUrl;
    } catch (err: unknown) {
      toast({
        title: 'Checkout unavailable',
        description: (err as Error)?.message || 'Could not start checkout. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const total = cartTotal(items);

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-24 max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Shopping Cart</h1>

        {items.length === 0 ? (
          <div className="border-t border-b py-16 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400">
              <ShoppingCart className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Your cart is empty</h2>
              <p className="text-muted-foreground">Looks like you haven't added anything yet.</p>
            </div>
            <Button asChild className="rounded-none mt-4 uppercase tracking-widest text-sm h-12 px-8" style={{ backgroundColor: 'var(--brand-primary)' }}>
              <a href={sp('/products')}>Continue Shopping</a>
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="border-t">
              {items.map((item) => (
                <div key={`${item.productId}-${item.variantId}`} className="flex items-center gap-4 py-4 border-b">
                  <div className="w-20 h-24 bg-zinc-100 shrink-0 overflow-hidden">
                    {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{item.name}</p>
                    {item.variantLabel && <p className="text-sm text-muted-foreground">{item.variantLabel}</p>}
                    <p className="font-mono text-sm mt-1">${item.unitPrice.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 border hover:bg-zinc-50" onClick={() => updateQuantity(storeSlug, item.productId, item.variantId, item.quantity - 1)} aria-label="Decrease quantity">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center font-mono text-sm">{item.quantity}</span>
                    <button className="p-1.5 border hover:bg-zinc-50" onClick={() => updateQuantity(storeSlug, item.productId, item.variantId, item.quantity + 1)} aria-label="Increase quantity">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="font-mono w-24 text-right">${(item.unitPrice * item.quantity).toFixed(2)}</p>
                  <button className="p-1.5 text-muted-foreground hover:text-destructive" onClick={() => updateQuantity(storeSlug, item.productId, item.variantId, 0)} aria-label="Remove item">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-end gap-4">
              <div className="flex items-baseline gap-4">
                <span className="text-sm uppercase tracking-widest text-muted-foreground">Total</span>
                <span className="text-2xl font-mono font-bold">${total.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Payment is processed securely at checkout.</p>
              <Button
                className="rounded-none uppercase tracking-widest text-sm h-12 px-10"
                style={{ backgroundColor: 'var(--brand-primary)', color: 'white' }}
                onClick={handleCheckout}
                disabled={checkout.isPending}
              >
                {checkout.isPending ? 'Redirecting…' : 'Checkout'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
}

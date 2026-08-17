import { StorefrontLayout } from './Home';
import { useParams } from 'wouter';
import { Button } from '@/components/ui';
import { ShoppingCart } from 'lucide-react';

export default function StorefrontCart() {
  const { storeSlug } = useParams();

  // Purely placeholder for the requested pages - wire up not strictly required for local cart state given the brief constraints, 
  // but let's show the empty state nicely designed.

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-24 max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Shopping Cart</h1>
        
        <div className="border-t border-b py-16 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Your cart is empty</h2>
            <p className="text-muted-foreground">Looks like you haven't added anything yet.</p>
          </div>
          <Button asChild className="rounded-none mt-4 uppercase tracking-widest text-sm h-12 px-8" style={{ backgroundColor: 'var(--brand-primary)' }}>
            <a href={`/store/${storeSlug}/products`}>Continue Shopping</a>
          </Button>
        </div>
      </div>
    </StorefrontLayout>
  );
}

import { useEffect, useState } from 'react';
import { getCart } from './cart';

export function useCartCount(storeSlug: string): number {
  const [count, setCount] = useState(() =>
    storeSlug ? getCart(storeSlug).reduce((sum, i) => sum + i.quantity, 0) : 0
  );

  useEffect(() => {
    if (!storeSlug) return;
    const update = () => {
      setCount(getCart(storeSlug).reduce((sum, i) => sum + i.quantity, 0));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === `storefront-cart:${storeSlug}`) update();
    };
    update();
    window.addEventListener('cart-updated', update);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('cart-updated', update);
      window.removeEventListener('storage', onStorage);
    };
  }, [storeSlug]);

  return count;
}

import { useEffect, useState } from 'react';
import { readCartCount } from './cart';

export function useCartCount(storeSlug: string): number {
  const [count, setCount] = useState(() => {
    if (!storeSlug) return 0;
    // On mount: corrupt data → 0 (no existing count to preserve yet)
    return readCartCount(storeSlug).count;
  });

  useEffect(() => {
    if (!storeSlug) return;

    // Same-tab updates (cart-updated events from our own mutations).
    // We wrote the data ourselves, so corruption is unexpected; treat it
    // the same as mount: log and fall back to 0.
    const update = () => {
      const { count: next, corrupt } = readCartCount(storeSlug);
      if (corrupt) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[cart] Corrupt cart data — resetting count to 0.');
        }
        setCount(0);
        return;
      }
      setCount(next);
    };

    // Cross-tab updates (storage events from another tab).
    // Preserve the existing badge when the incoming data is corrupt.
    const onStorage = (e: StorageEvent) => {
      // key === null means localStorage.clear() was called from another tab.
      if (e.key !== null && e.key !== `storefront-cart:${storeSlug}`) return;

      const { count: next, corrupt } = readCartCount(storeSlug);
      if (corrupt) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[cart] Corrupt cart data detected in another tab — keeping existing count.');
        }
        return; // keep current count
      }
      setCount(next);
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

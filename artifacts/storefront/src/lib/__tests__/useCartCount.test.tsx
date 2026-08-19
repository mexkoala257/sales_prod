import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCartCount } from '../useCartCount';
import { addToCart, clearCart } from '../cart';

// ---------------------------------------------------------------------------
// localStorage mock
// jsdom provides a real window.dispatchEvent so events flow to listeners.
// We only mock localStorage to give each test a clean, inspectable store.
// ---------------------------------------------------------------------------
const store: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SLUG = 'hook-test-store';

const baseItem = {
  productId: 1,
  variantId: null as null,
  name: 'Widget',
  variantLabel: null as null,
  unitPrice: 9.99,
  imageUrl: null as null,
};

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useCartCount', () => {
  it('returns 0 when the cart is empty', () => {
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(0);
  });

  it('returns 0 when slug is an empty string', () => {
    const { result } = renderHook(() => useCartCount(''));
    expect(result.current).toBe(0);
  });

  it('reads the initial count from localStorage on mount', () => {
    // Pre-populate before the hook mounts
    const items = [{ ...baseItem, quantity: 4 }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(items);
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(4);
  });

  it('updates the count when addToCart dispatches cart-updated', () => {
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(0);

    act(() => {
      addToCart(SLUG, baseItem, 2);
    });

    expect(result.current).toBe(2);
  });

  it('sums quantities across multiple addToCart calls', () => {
    const { result } = renderHook(() => useCartCount(SLUG));

    act(() => {
      addToCart(SLUG, { ...baseItem, productId: 1 }, 3);
      addToCart(SLUG, { ...baseItem, productId: 2 }, 2);
    });

    expect(result.current).toBe(5);
  });

  it('resets to 0 after clearCart dispatches cart-updated', () => {
    // Mount with pre-populated cart
    const items = [{ ...baseItem, quantity: 5 }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(items);
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(5);

    act(() => {
      clearCart(SLUG);
    });

    expect(result.current).toBe(0);
  });

  it('updates when a storage event fires for the correct key (cross-tab sync)', () => {
    const { result } = renderHook(() => useCartCount(SLUG));

    act(() => {
      const items = [{ ...baseItem, quantity: 3 }];
      store[`storefront-cart:${SLUG}`] = JSON.stringify(items);

      window.dispatchEvent(
        Object.assign(new Event('storage'), {
          key: `storefront-cart:${SLUG}`,
          newValue: JSON.stringify(items),
        }) as StorageEvent,
      );
    });

    expect(result.current).toBe(3);
  });

  it('does not update when a storage event fires for a different key', () => {
    const items = [{ ...baseItem, quantity: 2 }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(items);
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(2);

    act(() => {
      window.dispatchEvent(
        Object.assign(new Event('storage'), {
          key: `storefront-cart:other-store`,
          newValue: '[]',
        }) as StorageEvent,
      );
    });

    expect(result.current).toBe(2);
  });

  it('removes event listeners on unmount (no memory leaks)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useCartCount(SLUG));
    unmount();

    expect(addSpy.mock.calls.map((c) => c[0])).toContain('cart-updated');
    expect(addSpy.mock.calls.map((c) => c[0])).toContain('storage');
    expect(removeSpy.mock.calls.map((c) => c[0])).toContain('cart-updated');
    expect(removeSpy.mock.calls.map((c) => c[0])).toContain('storage');
  });
});

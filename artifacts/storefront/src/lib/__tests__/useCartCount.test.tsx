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
  vi.restoreAllMocks();
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

  it('returns 0 on mount when stored data is malformed JSON', () => {
    store[`storefront-cart:${SLUG}`] = 'not-valid-json{{{';
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(0);
  });

  it('returns 0 on mount when stored data contains null entries ([null])', () => {
    store[`storefront-cart:${SLUG}`] = JSON.stringify([null]);
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(0);
  });

  it('returns 0 on mount when stored data contains empty objects ([{}])', () => {
    store[`storefront-cart:${SLUG}`] = JSON.stringify([{}]);
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(0);
  });

  it('returns 0 on mount when stored data contains items with invalid quantity', () => {
    const bad = [{ ...baseItem, quantity: 'two' }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(bad);
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(0);
  });

  it('returns 0 on mount when stored data contains partial items (missing unitPrice)', () => {
    const partial = [{ productId: 1, variantId: null, name: 'X', variantLabel: null, quantity: 3, imageUrl: null }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(partial);
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(0);
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

  it('preserves the count when a storage event carries malformed JSON', () => {
    // Start with a known count
    const items = [{ ...baseItem, quantity: 7 }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(items);
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(7);

    act(() => {
      // Another tab writes garbage
      store[`storefront-cart:${SLUG}`] = 'not-valid-json{{{';

      window.dispatchEvent(
        Object.assign(new Event('storage'), {
          key: `storefront-cart:${SLUG}`,
          newValue: 'not-valid-json{{{',
        }) as StorageEvent,
      );
    });

    // Count must NOT silently drop to 0
    expect(result.current).toBe(7);
  });

  it('preserves the count when a storage event carries a non-array JSON value', () => {
    const items = [{ ...baseItem, quantity: 3 }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(items);
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(3);

    act(() => {
      store[`storefront-cart:${SLUG}`] = JSON.stringify({ corrupted: true });

      window.dispatchEvent(
        Object.assign(new Event('storage'), {
          key: `storefront-cart:${SLUG}`,
          newValue: JSON.stringify({ corrupted: true }),
        }) as StorageEvent,
      );
    });

    expect(result.current).toBe(3);
  });

  it('preserves the count when a storage event carries an array with null entries ([null])', () => {
    const items = [{ ...baseItem, quantity: 6 }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(items);
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(6);

    act(() => {
      store[`storefront-cart:${SLUG}`] = JSON.stringify([null]);
      window.dispatchEvent(
        Object.assign(new Event('storage'), {
          key: `storefront-cart:${SLUG}`,
          newValue: JSON.stringify([null]),
        }) as StorageEvent,
      );
    });

    expect(result.current).toBe(6);
  });

  it('preserves the count when a storage event carries an array with empty objects ([{}])', () => {
    const items = [{ ...baseItem, quantity: 4 }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(items);
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(4);

    act(() => {
      store[`storefront-cart:${SLUG}`] = JSON.stringify([{}]);
      window.dispatchEvent(
        Object.assign(new Event('storage'), {
          key: `storefront-cart:${SLUG}`,
          newValue: JSON.stringify([{}]),
        }) as StorageEvent,
      );
    });

    expect(result.current).toBe(4);
  });

  it('preserves the count when a storage event carries an array with invalid quantity', () => {
    const items = [{ ...baseItem, quantity: 2 }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(items);
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(2);

    act(() => {
      const bad = [{ ...baseItem, quantity: 'two' }];
      store[`storefront-cart:${SLUG}`] = JSON.stringify(bad);
      window.dispatchEvent(
        Object.assign(new Event('storage'), {
          key: `storefront-cart:${SLUG}`,
          newValue: JSON.stringify(bad),
        }) as StorageEvent,
      );
    });

    expect(result.current).toBe(2);
  });

  it('preserves the count when a storage event carries a partial CartItem (missing unitPrice)', () => {
    const items = [{ ...baseItem, quantity: 5 }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(items);
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(5);

    act(() => {
      // Missing unitPrice — structurally partial, not a valid CartItem
      const partial = [{ productId: 1, variantId: null, name: 'X', variantLabel: null, quantity: 3, imageUrl: null }];
      store[`storefront-cart:${SLUG}`] = JSON.stringify(partial);
      window.dispatchEvent(
        Object.assign(new Event('storage'), {
          key: `storefront-cart:${SLUG}`,
          newValue: JSON.stringify(partial),
        }) as StorageEvent,
      );
    });

    expect(result.current).toBe(5);
  });

  it('preserves the count when a storage event carries a partial CartItem (missing variantLabel)', () => {
    const items = [{ ...baseItem, quantity: 3 }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(items);
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(3);

    act(() => {
      // Missing variantLabel — required field (must be explicitly null)
      const partial = [{ productId: 1, variantId: null, name: 'X', unitPrice: 10, quantity: 2, imageUrl: null }];
      store[`storefront-cart:${SLUG}`] = JSON.stringify(partial);
      window.dispatchEvent(
        Object.assign(new Event('storage'), {
          key: `storefront-cart:${SLUG}`,
          newValue: JSON.stringify(partial),
        }) as StorageEvent,
      );
    });

    expect(result.current).toBe(3);
  });

  it('resets to 0 when another tab calls localStorage.clear() (storage event with key === null)', () => {
    const items = [{ ...baseItem, quantity: 5 }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(items);
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(5);

    act(() => {
      // Simulate localStorage.clear() from another tab: key is null, all storage gone
      localStorageMock.clear();
      window.dispatchEvent(
        Object.assign(new Event('storage'), {
          key: null,
          newValue: null,
        }) as StorageEvent,
      );
    });

    // Missing key after clear = intentionally empty = 0
    expect(result.current).toBe(0);
  });

  it('resets to 0 when another tab removes this cart key (key present, newValue null)', () => {
    const items = [{ ...baseItem, quantity: 4 }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(items);
    const { result } = renderHook(() => useCartCount(SLUG));
    expect(result.current).toBe(4);

    act(() => {
      // Tab removes the specific cart key
      delete store[`storefront-cart:${SLUG}`];

      window.dispatchEvent(
        Object.assign(new Event('storage'), {
          key: `storefront-cart:${SLUG}`,
          newValue: null,
        }) as StorageEvent,
      );
    });

    // Missing key = intentionally empty cart = 0 is correct
    expect(result.current).toBe(0);
  });

  it('logs a console.error in dev when cart data is corrupt', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const items = [{ ...baseItem, quantity: 2 }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(items);
    renderHook(() => useCartCount(SLUG));

    act(() => {
      store[`storefront-cart:${SLUG}`] = 'bad-data';
      window.dispatchEvent(
        Object.assign(new Event('storage'), {
          key: `storefront-cart:${SLUG}`,
          newValue: 'bad-data',
        }) as StorageEvent,
      );
    });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[cart]'),
    );
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

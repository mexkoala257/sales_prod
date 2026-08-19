import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCart, addToCart, updateQuantity, clearCart, cartTotal } from '../cart';

// ---------------------------------------------------------------------------
// localStorage mock
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

// Stub CustomEvent + window.dispatchEvent so save() doesn't throw in jsdom
globalThis.dispatchEvent = vi.fn();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SLUG = 'test-store';

const item = (overrides: Partial<Parameters<typeof addToCart>[1]> = {}) => ({
  productId: 1,
  variantId: null,
  name: 'Test Product',
  variantLabel: null,
  unitPrice: 10,
  imageUrl: null,
  ...overrides,
});

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getCart
// ---------------------------------------------------------------------------
describe('getCart', () => {
  it('returns an empty array when nothing is stored', () => {
    expect(getCart(SLUG)).toEqual([]);
  });

  it('returns parsed items when the key exists', () => {
    const items = [{ productId: 1, variantId: null, name: 'A', variantLabel: null, unitPrice: 5, quantity: 2, imageUrl: null }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(items);
    expect(getCart(SLUG)).toEqual(items);
  });

  it('returns an empty array when stored JSON is malformed', () => {
    store[`storefront-cart:${SLUG}`] = 'not-json{{{';
    expect(getCart(SLUG)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// addToCart
// ---------------------------------------------------------------------------
describe('addToCart', () => {
  it('adds a new item with the given quantity', () => {
    addToCart(SLUG, item(), 3);
    const cart = getCart(SLUG);
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(3);
  });

  it('defaults quantity to 1 when not specified', () => {
    addToCart(SLUG, item());
    expect(getCart(SLUG)[0].quantity).toBe(1);
  });

  it('increments quantity when the same productId + variantId is added again', () => {
    addToCart(SLUG, item(), 2);
    addToCart(SLUG, item(), 3);
    const cart = getCart(SLUG);
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(5);
  });

  it('treats different variantIds as separate line items', () => {
    addToCart(SLUG, item({ variantId: 1 }));
    addToCart(SLUG, item({ variantId: 2 }));
    expect(getCart(SLUG)).toHaveLength(2);
  });

  it('treats different productIds as separate line items', () => {
    addToCart(SLUG, item({ productId: 1 }));
    addToCart(SLUG, item({ productId: 2 }));
    expect(getCart(SLUG)).toHaveLength(2);
  });

  it('dispatches a cart-updated event', () => {
    addToCart(SLUG, item());
    expect(globalThis.dispatchEvent).toHaveBeenCalledOnce();
    const evt = (globalThis.dispatchEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(evt.type).toBe('cart-updated');
    expect(evt.detail).toEqual({ slug: SLUG });
  });

  it('scopes cart to the given slug', () => {
    addToCart(SLUG, item());
    addToCart('other-store', item({ productId: 99 }));
    expect(getCart(SLUG)).toHaveLength(1);
    expect(getCart('other-store')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// updateQuantity
// ---------------------------------------------------------------------------
describe('updateQuantity', () => {
  beforeEach(() => {
    addToCart(SLUG, item({ productId: 1, variantId: null }));
  });

  it('sets the quantity to the new value', () => {
    updateQuantity(SLUG, 1, null, 7);
    expect(getCart(SLUG)[0].quantity).toBe(7);
  });

  it('removes the item when quantity is 0', () => {
    updateQuantity(SLUG, 1, null, 0);
    expect(getCart(SLUG)).toHaveLength(0);
  });

  it('removes the item when quantity is negative', () => {
    updateQuantity(SLUG, 1, null, -1);
    expect(getCart(SLUG)).toHaveLength(0);
  });

  it('is a no-op when the item does not exist', () => {
    updateQuantity(SLUG, 999, null, 5);
    expect(getCart(SLUG)).toHaveLength(1); // original item untouched
  });

  it('dispatches a cart-updated event', () => {
    vi.clearAllMocks();
    updateQuantity(SLUG, 1, null, 3);
    expect(globalThis.dispatchEvent).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// clearCart
// ---------------------------------------------------------------------------
describe('clearCart', () => {
  it('empties the cart', () => {
    addToCart(SLUG, item());
    clearCart(SLUG);
    expect(getCart(SLUG)).toEqual([]);
  });

  it('dispatches a cart-updated event', () => {
    vi.clearAllMocks();
    clearCart(SLUG);
    expect(globalThis.dispatchEvent).toHaveBeenCalledOnce();
  });

  it('does not affect other slugs', () => {
    addToCart('another', item());
    clearCart(SLUG);
    expect(getCart('another')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// cartTotal
// ---------------------------------------------------------------------------
describe('cartTotal', () => {
  it('returns 0 for an empty cart', () => {
    expect(cartTotal([])).toBe(0);
  });

  it('sums unitPrice × quantity for each item', () => {
    const items = [
      { productId: 1, variantId: null, name: 'A', variantLabel: null, unitPrice: 10, quantity: 2, imageUrl: null },
      { productId: 2, variantId: null, name: 'B', variantLabel: null, unitPrice: 5, quantity: 3, imageUrl: null },
    ];
    expect(cartTotal(items)).toBe(35);
  });
});

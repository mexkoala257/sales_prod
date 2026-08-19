import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCart, addToCart, updateQuantity, clearCart, cartTotal, readCartCount } from '../cart';

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

  it('returns an empty array when stored JSON is malformed (safe for callers)', () => {
    store[`storefront-cart:${SLUG}`] = 'not-json{{{';
    expect(getCart(SLUG)).toEqual([]);
  });

  it('returns an empty array when stored value is a JSON object, not an array', () => {
    store[`storefront-cart:${SLUG}`] = JSON.stringify({ foo: 'bar' });
    expect(getCart(SLUG)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// readCartCount
// ---------------------------------------------------------------------------
describe('readCartCount', () => {
  it('returns count 0, corrupt false when key is missing', () => {
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: false });
  });

  it('returns correct count and corrupt false for a valid cart', () => {
    const items = [
      { productId: 1, variantId: null, name: 'A', variantLabel: null, unitPrice: 5, quantity: 2, imageUrl: null },
      { productId: 2, variantId: null, name: 'B', variantLabel: null, unitPrice: 3, quantity: 3, imageUrl: null },
    ];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(items);
    expect(readCartCount(SLUG)).toEqual({ count: 5, corrupt: false });
  });

  it('returns count 0, corrupt true for malformed JSON', () => {
    store[`storefront-cart:${SLUG}`] = 'not-json{{{';
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
  });

  it('returns count 0, corrupt true when stored value is a JSON object (not an array)', () => {
    store[`storefront-cart:${SLUG}`] = JSON.stringify({ corrupted: true });
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
  });

  it('returns count 0, corrupt true when stored value is a JSON string', () => {
    store[`storefront-cart:${SLUG}`] = JSON.stringify('hello');
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
  });

  it('returns count 0, corrupt true when stored value is JSON null', () => {
    store[`storefront-cart:${SLUG}`] = 'null';
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
  });

  it('returns count 0, corrupt true when array contains a null entry ([null])', () => {
    store[`storefront-cart:${SLUG}`] = JSON.stringify([null]);
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
  });

  it('returns count 0, corrupt true when array contains an object missing required fields ([{}])', () => {
    store[`storefront-cart:${SLUG}`] = JSON.stringify([{}]);
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
  });

  it('returns count 0, corrupt true when an item has a non-numeric quantity', () => {
    const bad = [{ productId: 1, variantId: null, name: 'X', variantLabel: null, unitPrice: 5, quantity: 'two', imageUrl: null }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(bad);
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
  });

  it('returns count 0, corrupt true when an item has a negative quantity', () => {
    const bad = [{ productId: 1, variantId: null, name: 'X', variantLabel: null, unitPrice: 5, quantity: -3, imageUrl: null }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(bad);
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
  });

  it('returns count 0, corrupt true when an item has a non-finite quantity (Infinity)', () => {
    // JSON.stringify converts Infinity to null, simulating externally injected data
    store[`storefront-cart:${SLUG}`] = '[{"productId":1,"variantId":null,"name":"X","variantLabel":null,"unitPrice":5,"quantity":null,"imageUrl":null}]';
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
  });

  it('returns count 0, corrupt false for an empty valid array', () => {
    store[`storefront-cart:${SLUG}`] = '[]';
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: false });
  });

  // --- Per-field validation ---

  it('returns corrupt true when productId is missing', () => {
    const bad = [{ variantId: null, name: 'X', variantLabel: null, unitPrice: 5, quantity: 1, imageUrl: null }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(bad);
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
  });

  it('returns corrupt true when productId is non-finite (Infinity serialized as null)', () => {
    store[`storefront-cart:${SLUG}`] = '[{"productId":null,"variantId":null,"name":"X","variantLabel":null,"unitPrice":5,"quantity":1,"imageUrl":null}]';
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
  });

  it('returns corrupt true when variantId is an invalid type (string instead of null/number)', () => {
    const bad = [{ productId: 1, variantId: 'bad', name: 'X', variantLabel: null, unitPrice: 5, quantity: 1, imageUrl: null }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(bad);
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
  });

  it('returns corrupt true when name is missing', () => {
    const bad = [{ productId: 1, variantId: null, variantLabel: null, unitPrice: 5, quantity: 1, imageUrl: null }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(bad);
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
  });

  it('returns corrupt true when variantLabel is missing (not present, not null)', () => {
    const bad = [{ productId: 1, variantId: null, name: 'X', unitPrice: 5, quantity: 1, imageUrl: null }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(bad);
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
  });

  it('returns corrupt true when unitPrice is missing', () => {
    const bad = [{ productId: 1, variantId: null, name: 'X', variantLabel: null, quantity: 1, imageUrl: null }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(bad);
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
  });

  it('returns corrupt true when unitPrice is non-finite', () => {
    store[`storefront-cart:${SLUG}`] = '[{"productId":1,"variantId":null,"name":"X","variantLabel":null,"unitPrice":null,"quantity":1,"imageUrl":null}]';
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
  });

  it('returns corrupt true when imageUrl is missing (not present, not null)', () => {
    const bad = [{ productId: 1, variantId: null, name: 'X', variantLabel: null, unitPrice: 5, quantity: 1 }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(bad);
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
  });

  it('returns corrupt true when imageUrl is an invalid type (number)', () => {
    const bad = [{ productId: 1, variantId: null, name: 'X', variantLabel: null, unitPrice: 5, quantity: 1, imageUrl: 42 }];
    store[`storefront-cart:${SLUG}`] = JSON.stringify(bad);
    expect(readCartCount(SLUG)).toEqual({ count: 0, corrupt: true });
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

  it('recovers gracefully when stored data is corrupt (starts a fresh cart)', () => {
    store[`storefront-cart:${SLUG}`] = 'bad-json';
    // addToCart uses getCart (safe) so it starts fresh rather than crashing
    addToCart(SLUG, item(), 1);
    expect(getCart(SLUG)).toHaveLength(1);
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

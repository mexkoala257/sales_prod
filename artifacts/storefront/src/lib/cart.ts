/**
 * Minimal localStorage-backed retail cart, scoped per store slug.
 * Checkout hands the line items to Shopify's hosted checkout — the platform
 * never handles B2C payment itself.
 */

export interface CartItem {
  productId: number;
  variantId: number | null;
  name: string;
  variantLabel: string | null;
  unitPrice: number;
  quantity: number;
  imageUrl: string | null;
}

const keyFor = (slug: string) => `storefront-cart:${slug}`;

/**
 * Returns the current cart items for a store slug.
 * Always returns a safe empty array when the key is missing OR when the stored
 * value is corrupt — this keeps callers (Cart page, mutations) crash-free.
 */
export function getCart(slug: string): CartItem[] {
  try {
    const raw = localStorage.getItem(keyFor(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

/** Returns true when a value is a well-formed CartItem (complete schema check). */
function isValidCartItem(item: unknown): item is CartItem {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return false;
  const i = item as Record<string, unknown>;
  return (
    // productId: finite number
    typeof i.productId === 'number' && Number.isFinite(i.productId) &&
    // variantId: null or finite number
    (i.variantId === null || (typeof i.variantId === 'number' && Number.isFinite(i.variantId))) &&
    // name: string (required)
    typeof i.name === 'string' &&
    // variantLabel: null or string
    (i.variantLabel === null || typeof i.variantLabel === 'string') &&
    // unitPrice: finite non-negative number
    typeof i.unitPrice === 'number' && Number.isFinite(i.unitPrice) && i.unitPrice >= 0 &&
    // quantity: finite non-negative number
    typeof i.quantity === 'number' && Number.isFinite(i.quantity) && i.quantity >= 0 &&
    // imageUrl: null or string
    (i.imageUrl === null || typeof i.imageUrl === 'string')
  );
}

/**
 * Reads the cart and returns a count result that distinguishes three states:
 *   - Missing key            → { count: 0, corrupt: false }  — intentionally empty cart
 *   - Valid array            → { count: N, corrupt: false }
 *   - Corrupt/invalid data   → { count: 0, corrupt: true }   — do NOT silently zero the badge
 *
 * Validates every entry in the array so that structurally malformed items
 * (e.g. `[{}]`, `[null]`, non-numeric quantities) are detected as corruption.
 *
 * Used only by useCartCount so it can preserve the displayed count rather than
 * silently resetting it when another tab writes malformed data.
 */
export function readCartCount(slug: string): { count: number; corrupt: boolean } {
  try {
    const raw = localStorage.getItem(keyFor(slug));
    if (raw === null) return { count: 0, corrupt: false };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { count: 0, corrupt: true };
    for (const entry of parsed) {
      if (!isValidCartItem(entry)) return { count: 0, corrupt: true };
    }
    const count = (parsed as CartItem[]).reduce((sum, i) => sum + i.quantity, 0);
    return { count, corrupt: false };
  } catch {
    return { count: 0, corrupt: true };
  }
}

function save(slug: string, items: CartItem[]): void {
  localStorage.setItem(keyFor(slug), JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("cart-updated", { detail: { slug } }));
}

export function addToCart(slug: string, item: Omit<CartItem, "quantity">, quantity = 1): void {
  const items = getCart(slug);
  const existing = items.find((i) => i.productId === item.productId && i.variantId === item.variantId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ ...item, quantity });
  }
  save(slug, items);
}

export function updateQuantity(slug: string, productId: number, variantId: number | null, quantity: number): void {
  let items = getCart(slug);
  if (quantity <= 0) {
    items = items.filter((i) => !(i.productId === productId && i.variantId === variantId));
  } else {
    const item = items.find((i) => i.productId === productId && i.variantId === variantId);
    if (item) item.quantity = quantity;
  }
  save(slug, items);
}

export function clearCart(slug: string): void {
  save(slug, []);
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

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

export function getCart(slug: string): CartItem[] {
  try {
    const raw = localStorage.getItem(keyFor(slug));
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
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

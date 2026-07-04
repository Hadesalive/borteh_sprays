import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

// Local-only bag. Online-first app (ADR), but the bag lives on the device so a tap to "Add"
// is instant and survives a reload. We persist only the durable facts (which variant, the
// price at add-time, how many); name/image are re-resolved from the live catalog by slug, so
// nothing here goes stale and we never persist a bundled-asset module id.
export type CartItem = {
  variantId: string;
  slug: string;
  sizeMl: number;
  priceMinor: number;
  qty: number;
};

const KEY = "borteh.cart.v1";
let items: CartItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => {});
}

// Hydrate once at startup, then notify any mounted subscribers.
AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      items = parsed;
      listeners.forEach((l) => l());
    }
  })
  .catch(() => {});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => items;

/** The whole bag (cheapest-added first kept in insertion order). */
export const useCart = () => useSyncExternalStore(subscribe, snapshot, snapshot);

/** Total item count for the tab badge. */
export const useCartCount = () =>
  useSyncExternalStore(
    subscribe,
    () => items.reduce((n, i) => n + i.qty, 0),
    () => items.reduce((n, i) => n + i.qty, 0),
  );

export function addToBag(item: Omit<CartItem, "qty">, qty = 1) {
  const existing = items.find((i) => i.variantId === item.variantId);
  items = existing
    ? items.map((i) => (i.variantId === item.variantId ? { ...i, qty: i.qty + qty } : i))
    : [...items, { ...item, qty }];
  emit();
}

export function setQty(variantId: string, qty: number) {
  items = qty <= 0 ? items.filter((i) => i.variantId !== variantId) : items.map((i) => (i.variantId === variantId ? { ...i, qty } : i));
  emit();
}

export function removeFromBag(variantId: string) {
  items = items.filter((i) => i.variantId !== variantId);
  emit();
}

export function clearBag() {
  items = [];
  emit();
}

export const cartTotalMinor = (list: CartItem[]) => list.reduce((sum, i) => sum + i.priceMinor * i.qty, 0);

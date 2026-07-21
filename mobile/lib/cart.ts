import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { track } from "./track";

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
  productId?: string; // carried for recs event attribution; optional so old persisted carts still load
};

// A pair the shopper added as a combo. The bottles live in `items` like any other;
// this only records the INTENT so checkout can claim the deal price. The server
// re-validates + prices it, so a stale claim (bottle later removed) just yields no
// discount rather than a bad charge.
export type ComboClaim = { comboId: string; slug: string; qty: number };

const KEY = "borteh.cart.v1";
let items: CartItem[] = [];
const listeners = new Set<() => void>();

const COMBO_KEY = "borteh.combos.v1";
let combos: ComboClaim[] = [];
const comboListeners = new Set<() => void>();

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

function emitCombos() {
  comboListeners.forEach((l) => l());
  AsyncStorage.setItem(COMBO_KEY, JSON.stringify(combos)).catch(() => {});
}

AsyncStorage.getItem(COMBO_KEY)
  .then((raw) => {
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      combos = parsed;
      comboListeners.forEach((l) => l());
    }
  })
  .catch(() => {});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => items;

const subscribeCombos = (l: () => void) => {
  comboListeners.add(l);
  return () => comboListeners.delete(l);
};
const snapshotCombos = () => combos;

/** The whole bag (cheapest-added first kept in insertion order). */
export const useCart = () => useSyncExternalStore(subscribe, snapshot, snapshot);

/** Pairs the shopper added as combos — used to claim deal pricing at checkout. */
export const useCartCombos = () => useSyncExternalStore(subscribeCombos, snapshotCombos, snapshotCombos);

/** Record that a combo was added to the bag (its bottles go in via addToBag). */
export function addComboClaim(comboId: string, slug: string, qty = 1) {
  const existing = combos.find((c) => c.comboId === comboId);
  combos = existing
    ? combos.map((c) => (c.comboId === comboId ? { ...c, qty: c.qty + qty } : c))
    : [...combos, { comboId, slug, qty }];
  emitCombos();
}

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
  track("add_to_bag", { productId: item.productId, metadata: { variantId: item.variantId, slug: item.slug, qty, priceMinor: item.priceMinor } });
}

export function setQty(variantId: string, qty: number) {
  items = qty <= 0 ? items.filter((i) => i.variantId !== variantId) : items.map((i) => (i.variantId === variantId ? { ...i, qty } : i));
  emit();
}

export function removeFromBag(variantId: string) {
  const removed = items.find((i) => i.variantId === variantId);
  items = items.filter((i) => i.variantId !== variantId);
  emit();
  if (removed) track("remove_from_bag", { productId: removed.productId, metadata: { variantId, slug: removed.slug } });
}

export function clearBag() {
  items = [];
  combos = [];
  emit();
  emitCombos();
}

export const cartTotalMinor = (list: CartItem[]) => list.reduce((sum, i) => sum + i.priceMinor * i.qty, 0);

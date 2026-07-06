import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { track } from "./track";

// Local, persisted wishlist of product slugs. Same external-store pattern as the cart so the
// heart on the product page is real (survives reload) and the Wishlist tab reflects it.
const KEY = "borteh.wishlist.v1";
let slugs: string[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify(slugs)).catch(() => {});
}

AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      slugs = parsed;
      listeners.forEach((l) => l());
    }
  })
  .catch(() => {});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => slugs;

/** Reactive list of wished slugs (newest first). */
export const useWishlist = () => useSyncExternalStore(subscribe, snapshot, snapshot);

// productId is optional (the store keys on slug) — passed by callers that hold the Product so
// the recs event carries a real product_id. Add/remove is derived from pre-toggle membership.
export function toggleWish(slug: string, productId?: string) {
  const wasWished = slugs.includes(slug);
  slugs = wasWished ? slugs.filter((s) => s !== slug) : [slug, ...slugs];
  emit();
  track(wasWished ? "wishlist_remove" : "wishlist_add", { productId, metadata: { slug } });
}

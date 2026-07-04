import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

// Local, persisted "recently viewed" trail of product slugs — newest first, capped.
const KEY = "borteh.recent.v1";
const CAP = 12;
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

/** Reactive list of recently-viewed slugs, newest first. */
export const useRecentlyViewed = () => useSyncExternalStore(subscribe, snapshot, snapshot);

/** Record a product view (moves it to the front, de-duped, capped). */
export function recordView(slug: string) {
  if (slugs[0] === slug) return; // already most-recent — avoid needless writes
  slugs = [slug, ...slugs.filter((s) => s !== slug)].slice(0, CAP);
  emit();
}

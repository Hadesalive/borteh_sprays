import { useSyncExternalStore } from "react";

// Which product slug is being peeked (long-press preview), or null. App-wide so any card can open it.
let current: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const openPeek = (slug: string) => {
  current = slug;
  emit();
};
export const closePeek = () => {
  current = null;
  emit();
};

export const useQuickPeek = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );

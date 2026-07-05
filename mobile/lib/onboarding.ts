import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

// One-time first-launch flag. null = still hydrating from disk.
const KEY = "borteh.onboarded.v1";
let seen: boolean | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

AsyncStorage.getItem(KEY)
  .then((v) => { seen = v === "1"; emit(); })
  .catch(() => { seen = false; emit(); });

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

/** true = onboarded, false = needs onboarding, null = unknown (hydrating). Reactive. */
export const useOnboarded = () => useSyncExternalStore(subscribe, () => seen, () => seen);

export function markOnboarded() {
  seen = true;
  AsyncStorage.setItem(KEY, "1").catch(() => {});
  emit();
}

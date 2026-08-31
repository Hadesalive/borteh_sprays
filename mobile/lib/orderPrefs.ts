import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

// Whether the Orders list hides cancelled orders — a view filter, not a
// delete. Cancelled orders stay in the database (support/accounting record
// intact); this only controls what's shown. Persisted locally so the
// preference sticks, same pattern as paymentPrefs.ts/recentlyViewed.ts.
const KEY = "borteh.hide-cancelled-orders.v1";

let hidden = false;
const listeners = new Set<() => void>();

AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (raw === "1") {
      hidden = true;
      listeners.forEach((l) => l());
    }
  })
  .catch(() => {});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useHideCancelledOrders = () => useSyncExternalStore(subscribe, () => hidden, () => hidden);

export function setHideCancelledOrders(value: boolean) {
  hidden = value;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, value ? "1" : "0").catch(() => {});
}

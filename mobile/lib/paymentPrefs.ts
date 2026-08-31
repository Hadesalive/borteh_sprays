import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import type { PaymentMethod } from "./orders";
import type { MomoProvider } from "./payments";

// Remembers the customer's last-used checkout payment method so the payment
// step can open collapsed on it next time instead of always showing every
// option expanded — same local-persistence pattern as recentlyViewed.ts/cart.ts.
const KEY = "borteh.payment-default.v1";

export type DefaultPayment = { method: PaymentMethod; momoProvider: MomoProvider | null };

let value: DefaultPayment | null = null;
let loaded = false;
const listeners = new Set<() => void>();

AsyncStorage.getItem(KEY)
  .then((raw) => {
    loaded = true;
    if (!raw) {
      listeners.forEach((l) => l());
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.method === "string") {
      value = parsed;
      listeners.forEach((l) => l());
    }
  })
  .catch(() => {
    loaded = true;
  });

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => value;

/** The customer's last-used payment method, or null before load finishes / before their first order. */
export const useDefaultPayment = () => useSyncExternalStore(subscribe, snapshot, snapshot);

/** Whether the persisted default has finished loading from disk yet (avoids a flash of the wrong UI). */
export const useDefaultPaymentLoaded = () => useSyncExternalStore(subscribe, () => loaded, () => loaded);

/** Remember this choice as the default for next time. */
export function setDefaultPayment(method: PaymentMethod, momoProvider: MomoProvider | null) {
  value = { method, momoProvider };
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify(value)).catch(() => {});
}

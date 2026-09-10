// Cart arithmetic for the counter terminal. Money is integer minor units
// throughout (see lib/format) — the only float here is the percentage the
// cashier types, and it is rounded back to minor units immediately.

export type DiscountMode = "amount" | "percent";

export type CartTotals = {
  subtotal: number;
  /** Savings from tapped combo deals, clamped to the subtotal. */
  comboDiscount: number;
  /** The cashier's own discount, applied to what's left after combo deals. */
  manualDiscount: number;
  discount: number;
  total: number;
};

/**
 * Minor units taken off by a hand-entered discount, clamped to `base`.
 * `raw` is whatever the cashier typed: "10", "10.5", "Le 10", "" — anything
 * unparseable is no discount rather than an error, because this runs on every
 * keystroke while they are still typing.
 */
export function manualDiscountMinor(raw: string, mode: DiscountMode, base: number): number {
  if (base <= 0) return 0;
  // Strictly digits with at most one decimal point. Stripping stray characters
  // instead would read "-5" as 5 and quietly discount a sale the cashier was
  // trying to cancel out. A trailing "." is just mid-typing, so it's dropped.
  const text = raw.trim().replace(/\.$/, "");
  if (!/^\d*\.?\d+$/.test(text)) return 0;
  const n = Number.parseFloat(text);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const minor = mode === "percent" ? Math.round((base * Math.min(n, 100)) / 100) : Math.round(n * 100);
  return Math.min(minor, base);
}

/**
 * Fold line items, combo deals and the manual discount into the numbers the
 * cart shows. Combo deals come off first, so a "10% off" reads as 10% of what
 * the customer still owes rather than 10% of the pre-deal price.
 */
export function cartTotals({
  subtotal,
  comboSavings,
  discountRaw,
  discountMode,
}: {
  subtotal: number;
  comboSavings: number;
  discountRaw: string;
  discountMode: DiscountMode;
}): CartTotals {
  const comboDiscount = Math.min(Math.max(comboSavings, 0), Math.max(subtotal, 0));
  const base = subtotal - comboDiscount;
  const manualDiscount = manualDiscountMinor(discountRaw, discountMode, base);
  const discount = comboDiscount + manualDiscount;
  return { subtotal, comboDiscount, manualDiscount, discount, total: subtotal - discount };
}

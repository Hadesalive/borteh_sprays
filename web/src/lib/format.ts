// Money is stored as integer SLE minor units (cents). UI formats to "Le".
// Never do float math on money; format only at the edge.

const grouper = new Intl.NumberFormat("en-US");

/** Format integer minor units (cents) as a Leone amount, e.g. 245000 -> "Le 2,450". */
export function formatLe(minorUnits: number, decimals: 0 | 2 = 0): string {
  const major = minorUnits / 100;
  const value = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(major);
  return `Le ${value}`;
}

/** Group a plain integer, e.g. 1280 -> "1,280". */
export function formatInt(n: number): string {
  return grouper.format(n);
}

/** Percentage with one optional decimal, e.g. 0.626 -> "62.6%". */
export function formatPct(ratio: number, decimals = 0): string {
  return `${(ratio * 100).toFixed(decimals)}%`;
}

export type Delta = { direction: "up" | "down" | "flat"; label: string };

/** Build a signed change label from a ratio, e.g. 0.124 -> { up, "+12.4%" }. */
export function delta(ratio: number): Delta {
  const direction = ratio > 0.0005 ? "up" : ratio < -0.0005 ? "down" : "flat";
  const sign = ratio > 0 ? "+" : "";
  return { direction, label: `${sign}${(ratio * 100).toFixed(1)}%` };
}

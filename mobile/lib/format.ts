// All money is integer SLE minor units (Le 1.00 = 100). Format only at the UI edge (ADR-009).

function withThousands(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 62000 -> "Le 620"  ·  62050 -> "Le 620.50" */
export function formatLe(minor?: number | null): string {
  if (minor == null) return "—";
  const major = Math.round(minor) / 100;
  const whole = Math.floor(major);
  const cents = Math.round((major - whole) * 100);
  const head = `Le ${withThousands(String(whole))}`;
  return cents === 0 ? head : `${head}.${String(cents).padStart(2, "0")}`;
}

/** "from Le 380" for a product with multiple variants. */
export function formatFrom(minMinor?: number | null): string {
  return minMinor == null ? "—" : `from ${formatLe(minMinor)}`;
}

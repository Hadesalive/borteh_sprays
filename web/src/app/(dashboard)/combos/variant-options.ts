import { createServerClient } from "@/lib/supabase/server";
import type { VariantOption } from "@/components/admin/combo-form";

type PV = { id: string; size_ml: number; concentration: string; price_minor: number; is_active: boolean; deleted_at: string | null };
type P = { name: string; product_variant: PV[] | null };

/** Every purchasable variant as a picker option: "Product — 50 ml EDP" + its price. */
export async function loadVariantOptions(): Promise<VariantOption[]> {
  const db = createServerClient();
  const { data } = await db
    .from("product")
    .select("name, product_variant(id, size_ml, concentration, price_minor, is_active, deleted_at)")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");
  return ((data ?? []) as unknown as P[]).flatMap((p) =>
    (p.product_variant ?? [])
      .filter((v) => v.is_active && !v.deleted_at)
      .map((v) => ({ id: v.id, label: `${p.name} — ${v.size_ml} ml ${v.concentration}`, priceMinor: v.price_minor })),
  );
}

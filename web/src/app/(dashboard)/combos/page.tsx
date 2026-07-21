import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { CombosTable, type ComboRow } from "@/components/admin/combos-table";

export const dynamic = "force-dynamic";

type NameObj = { name: string };
type VP = { price_minor: number; product: NameObj | NameObj[] | null };
type CI = { qty: number; product_variant: VP | VP[] | null };
type Raw = { id: string; name: string; slug: string; is_active: boolean; combo_price_minor: number | null; combo_item: CI[] | null };

const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : (v ?? undefined));

export default async function CombosPage() {
  const db = createServerClient();
  const { data, error } = await db
    .from("combo")
    .select("id, name, slug, is_active, combo_price_minor, combo_item(qty, product_variant(price_minor, product(name)))")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const combos: ComboRow[] = ((data ?? []) as unknown as Raw[]).map((c) => {
    const its = c.combo_item ?? [];
    const resolved = its.map((it) => {
      const pv = one(it.product_variant);
      const prod = one(pv?.product);
      return { name: prod?.name, price: pv?.price_minor ?? 0, qty: it.qty ?? 1 };
    });
    const names = resolved.map((r) => r.name).filter((n): n is string => !!n);
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      active: c.is_active,
      itemCount: its.length,
      pairLabel: names.join(" + "),
      priceMinor: resolved.reduce((s, r) => s + r.price * r.qty, 0),
      dealMinor: c.combo_price_minor,
    };
  });
  const active = combos.filter((c) => c.active).length;

  return (
    <>
      <PageHeader
        title="Combos"
        description={
          error
            ? "Couldn't load combos — check the Supabase keys in web/.env.local."
            : `${combos.length} combos · ${active} live`
        }
      >
        <Link
          href="/combos/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Plus weight="duotone" className="size-4" />
          New combo
        </Link>
      </PageHeader>

      <p className="px-6 pt-4 text-xs text-muted-foreground lg:px-10">
        Pairs appear as “Perfect pairs” on the app home and “Complete the pair” on each fragrance’s page — only while every item is in stock.
      </p>

      <CombosTable combos={combos} />
    </>
  );
}

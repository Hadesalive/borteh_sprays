import { notFound } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";
import { ComboForm } from "@/components/admin/combo-form";
import { loadVariantOptions } from "../variant-options";

export const dynamic = "force-dynamic";

type CI = { variant_id: string; qty: number; sort_order: number };

export default async function EditComboPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createServerClient();
  const { data } = await db
    .from("combo")
    .select("id, name, slug, description, is_active, combo_price_minor, combo_item(variant_id, qty, sort_order)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) notFound();

  const variants = await loadVariantOptions();
  const items = ((data.combo_item ?? []) as unknown as CI[])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((it) => ({ variantId: it.variant_id, qty: it.qty }));

  return (
    <ComboForm
      variants={variants}
      initial={{
        id: data.id as string,
        name: data.name as string,
        slug: data.slug as string,
        description: (data.description as string | null) ?? "",
        active: data.is_active as boolean,
        items,
        dealPriceMinor: (data.combo_price_minor as number | null) ?? null,
      }}
    />
  );
}

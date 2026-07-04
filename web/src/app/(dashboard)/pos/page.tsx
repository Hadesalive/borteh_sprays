import { createServerClient } from "@/lib/supabase/server";
import { storageUrl } from "@/lib/supabase/storage";
import { PageHeader } from "@/components/admin/page-header";
import { PosTerminal, type CatalogItem } from "@/components/admin/pos-terminal";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const db = createServerClient();
  const { data } = await db
    .from("product_variant")
    .select("id, size_ml, concentration, sku, price_minor, product:product_id(name, is_active, product_image(storage_path, is_primary))")
    .eq("is_active", true)
    .limit(500);

  const variantIds = (data ?? []).map((v) => v.id as string);
  const { data: invRows } = variantIds.length
    ? await db.from("inventory_item").select("variant_id, qty_available").in("variant_id", variantIds)
    : { data: [] };
  const stockByVariant = new Map((invRows ?? []).map((r) => [r.variant_id as string, r.qty_available as number]));

  const catalog: CatalogItem[] = (data ?? [])
    .map((v) => {
      const product = v.product as unknown as { name: string; is_active: boolean | null; product_image: { storage_path: string; is_primary: boolean }[] } | null;
      if (!product || product.is_active === false) return null;
      const imgs = product.product_image ?? [];
      const primary = imgs.find((i) => i.is_primary) ?? imgs[0];
      return {
        id: v.id as string,
        name: product.name,
        meta: `${v.size_ml} ml${v.concentration ? ` · ${v.concentration}` : ""}`,
        sku: (v.sku as string) ?? "",
        price: v.price_minor as number,
        stock: stockByVariant.get(v.id as string) ?? 0,
        image: storageUrl(primary?.storage_path),
      } satisfies CatalogItem;
    })
    .filter((x): x is CatalogItem => x !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader title="Point of sale" description="Record a counter sale — search or tap to add." />
      <PosTerminal catalog={catalog} />
    </>
  );
}

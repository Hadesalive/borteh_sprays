import { createServerClient } from "@/lib/supabase/server";
import { formatInt } from "@/lib/format";
import { ProductsTable, type ProductRow } from "@/components/admin/products-table";

export const dynamic = "force-dynamic";

type Band = "in_stock" | "low" | "out";

type VariantRow = {
  price_minor: number | null;
  is_active: boolean | null;
  deleted_at: string | null;
  availability_signal: { band: Band } | { band: Band }[] | null;
};

type ProductRecord = {
  id: string;
  name: string | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  scent_family: string | null;
  brand: { name: string | null } | { name: string | null }[] | null;
  product_variant: VariantRow[] | null;
};

/** availability_signal / brand come back as an object (1:1) or a single-element array. */
function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

/** A product's band is its best variant: any in-stock → in_stock, else any low → low, else out. */
function rollupBand(bands: Band[]): Band | null {
  if (bands.length === 0) return null;
  if (bands.includes("in_stock")) return "in_stock";
  if (bands.includes("low")) return "low";
  return "out";
}

export default async function ProductsPage() {
  const db = createServerClient();
  const { data, error } = await db
    .from("product")
    .select(
      "id, name, is_active, is_featured, scent_family, brand(name), product_variant(price_minor, is_active, deleted_at, availability_signal(band))"
    )
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const records = (data ?? []) as unknown as ProductRecord[];

  const rows: ProductRow[] = records.map((p) => {
    const variants = (p.product_variant ?? []).filter((v) => !v.deleted_at);
    const live = variants.filter((v) => v.is_active !== false);
    const priced = (live.length ? live : variants)
      .map((v) => v.price_minor)
      .filter((n): n is number => typeof n === "number");
    const bands = (live.length ? live : variants)
      .map((v) => one(v.availability_signal)?.band)
      .filter((b): b is Band => b === "in_stock" || b === "low" || b === "out");

    return {
      id: p.id,
      name: p.name ?? "Untitled product",
      brand: one(p.brand)?.name ?? "—",
      family: p.scent_family?.trim() || null,
      fromPriceMinor: priced.length ? Math.min(...priced) : null,
      band: rollupBand(bands),
      active: p.is_active !== false,
      featured: p.is_featured === true,
      variantCount: variants.length,
    };
  });

  const needsAttention = rows.filter((r) => !r.family).length;
  const outOfStock = rows.filter((r) => r.band === "out" || r.band === null).length;

  const summary = [
    { n: formatInt(rows.length), label: "products", tone: "text-foreground" },
    { n: formatInt(rows.filter((r) => r.active).length), label: "active", tone: "text-foreground" },
    { n: formatInt(needsAttention), label: "need a scent family", tone: needsAttention ? "text-warning" : "text-foreground" },
    { n: formatInt(outOfStock), label: "out of stock", tone: outOfStock ? "text-destructive" : "text-foreground" },
  ];

  const empty = error ? "Couldn't load products — check the Supabase keys in web/.env.local." : "No products yet.";

  return <ProductsTable rows={rows} summary={summary} empty={empty} />;
}

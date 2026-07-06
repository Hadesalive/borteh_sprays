import { createServerClient } from "@/lib/supabase/server";
import { formatInt, formatLe } from "@/lib/format";
import { type Tone } from "@/components/admin/chip";
import { InventoryTable, type InvRow } from "@/components/admin/inventory-table";
import { type SummaryStat } from "@/components/admin/orders-table";

export const dynamic = "force-dynamic";

type VariantRow = {
  sku: string | null;
  size_ml: number | null;
  concentration: string | null;
  price_minor: number | null;
  product: { name: string | null; brand: { name: string | null } | null } | null;
} | null;

type InventoryRecord = {
  id: string;
  variant_id: string;
  qty_on_hand: number | null;
  qty_reserved: number | null;
  qty_available: number | null;
  reorder_point: number | null;
  product_variant: VariantRow;
};

function stockStatus(available: number, reorderPoint: number): { label: string; tone: Tone } {
  if (available <= 0) return { label: "Out", tone: "danger" };
  if (available <= reorderPoint) return { label: "Low", tone: "warning" };
  return { label: "In stock", tone: "success" };
}

export default async function InventoryPage() {
  const db = createServerClient();
  const [invRes, restockRes] = await Promise.all([
    db
      .from("inventory_item")
      .select("id, variant_id, qty_on_hand, qty_reserved, qty_available, reorder_point, product_variant(sku, size_ml, concentration, price_minor, product(name, brand(name)))")
      .order("qty_available", { ascending: true }),
    db.from("restock_subscription").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const records = (invRes.data ?? []) as unknown as InventoryRecord[];
  const restockers = restockRes.count ?? 0;

  const rows: InvRow[] = records.map((it) => {
    const v = it.product_variant;
    const available = it.qty_available ?? 0;
    const status = stockStatus(available, it.reorder_point ?? 0);
    const meta = [v?.product?.brand?.name, v?.size_ml != null ? `${v.size_ml} ml` : null, v?.concentration]
      .filter(Boolean)
      .join(" · ");
    return {
      id: it.id,
      variantId: it.variant_id,
      name: v?.product?.name ?? "Unknown product",
      meta,
      sku: v?.sku ?? "—",
      onHand: it.qty_on_hand ?? 0,
      available,
      reorderPoint: it.reorder_point ?? 0,
      priceMinor: v?.price_minor ?? null,
      statusLabel: status.label,
      statusTone: status.tone,
    };
  });

  const unitsOnHand = rows.reduce((s, r) => s + r.onHand, 0);
  const stockValue = rows.reduce((s, r) => s + r.onHand * (r.priceMinor ?? 0), 0);
  const low = rows.filter((r) => r.available > 0 && r.available <= r.reorderPoint).length;
  const out = rows.filter((r) => r.available <= 0).length;

  const summary: SummaryStat[] = [
    { n: formatInt(rows.length), label: "SKUs", tone: "text-foreground" },
    { n: formatInt(unitsOnHand), label: "units on hand", tone: "text-foreground" },
    { n: formatLe(stockValue), label: "stock value", tone: "text-foreground" },
    { n: formatInt(low), label: "low", tone: "text-warning" },
    { n: formatInt(out), label: "out", tone: "text-destructive" },
    { n: formatInt(restockers), label: "restock subscribers", tone: "text-foreground" },
  ];

  const empty = invRes.error ? "Inventory is unavailable right now." : "No inventory items yet.";

  return <InventoryTable rows={rows} summary={summary} empty={empty} />;
}

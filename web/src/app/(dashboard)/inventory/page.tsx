import { Package } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";
import { createServerClient } from "@/lib/supabase/server";
import { formatLe, formatInt } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { StatusPill, type PillTone } from "@/components/admin/status-pill";
import { InventoryReceive } from "@/components/admin/inventory-receive";

export const dynamic = "force-dynamic";

type VariantRow = {
  sku: string | null;
  size_ml: number | null;
  concentration: string | null;
  price_minor: number | null;
  product: { name: string | null; brand: { name: string | null } | null } | null;
} | null;

type InventoryRow = {
  id: string;
  variant_id: string;
  qty_on_hand: number | null;
  qty_reserved: number | null;
  qty_available: number | null;
  reorder_point: number | null;
  product_variant: VariantRow;
};

function stockStatus(available: number, reorderPoint: number): { label: string; tone: PillTone } {
  if (available <= 0) return { label: "Out", tone: "danger" };
  if (available <= reorderPoint) return { label: "Low", tone: "warning" };
  return { label: "In stock", tone: "success" };
}

export default async function InventoryPage() {
  const db = createServerClient();
  const { data, error } = await db
    .from("inventory_item")
    .select(
      "id, variant_id, qty_on_hand, qty_reserved, qty_available, reorder_point, product_variant(sku, size_ml, concentration, price_minor, product(name, brand(name)))"
    )
    .order("qty_available", { ascending: true });

  const rows = (data ?? []) as unknown as InventoryRow[];

  const lowCount = rows.filter((r) => {
    const available = r.qty_available ?? 0;
    return available > 0 && available <= (r.reorder_point ?? 0);
  }).length;
  const outCount = rows.filter((r) => (r.qty_available ?? 0) <= 0).length;

  return (
    <>
      <PageHeader
        title="Inventory"
        description={
          error
            ? "Couldn't load inventory — check the Supabase keys in web/.env.local."
            : `${rows.length} variants · ${lowCount} low · ${outCount} out`
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-6 py-2.5 font-medium lg:px-10">Product</th>
              <th className="px-3 py-2.5 font-medium">SKU</th>
              <th className="px-3 py-2.5 text-right font-medium">On hand</th>
              <th className="px-3 py-2.5 text-right font-medium">Reserved</th>
              <th className="px-3 py-2.5 text-right font-medium">Available</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-right font-medium">Price</th>
              <th className="px-6 py-2.5 text-right font-medium lg:px-10">Receive</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border border-t border-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center text-sm text-muted-foreground lg:px-10">
                  {error ? "Inventory is unavailable right now." : "No inventory items yet."}
                </td>
              </tr>
            ) : (
              rows.map((it) => {
                const variant = it.product_variant;
                const product = variant?.product;
                const name = product?.name ?? "Unknown product";
                const brand = product?.brand?.name;
                const sku = variant?.sku ?? "—";
                const onHand = it.qty_on_hand ?? 0;
                const reserved = it.qty_reserved ?? 0;
                const available = it.qty_available ?? 0;
                const reorderPoint = it.reorder_point ?? 0;
                const status = stockStatus(available, reorderPoint);

                const metaParts = [
                  brand,
                  variant?.size_ml != null ? `${variant.size_ml} ml` : null,
                  variant?.concentration,
                ].filter(Boolean);

                return (
                  <tr key={it.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-6 py-3.5 lg:px-10">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-border">
                          <Package weight="duotone" className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {metaParts.join(" · ")}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="nums px-3 py-3.5 text-xs text-muted-foreground">{sku}</td>
                    <td className="nums px-3 py-3.5 text-right">{formatInt(onHand)}</td>
                    <td className="nums px-3 py-3.5 text-right text-muted-foreground">
                      {formatInt(reserved)}
                    </td>
                    <td
                      className={cn(
                        "nums px-3 py-3.5 text-right font-semibold",
                        available <= 0 && "text-destructive",
                        available > 0 && available <= reorderPoint && "text-warning-soft-foreground"
                      )}
                    >
                      {formatInt(available)}
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusPill tone={status.tone} dot>
                        {status.label}
                      </StatusPill>
                    </td>
                    <td className="nums px-3 py-3.5 text-right font-medium">
                      {variant?.price_minor != null ? formatLe(variant.price_minor, 2) : "—"}
                    </td>
                    <td className="px-6 py-3.5 text-right lg:px-10">
                      <InventoryReceive variantId={it.variant_id} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

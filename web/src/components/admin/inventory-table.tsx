"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Package, Plus } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { formatInt, formatLe } from "@/lib/format";
import { Chip, type Tone } from "@/components/admin/chip";
import { receiveStock } from "@/app/(dashboard)/inventory/actions";
import type { SummaryStat } from "@/components/admin/orders-table";

export type InvRow = {
  id: string;
  variantId: string;
  name: string;
  meta: string;
  sku: string;
  onHand: number;
  available: number;
  reorderPoint: number;
  priceMinor: number | null;
  statusLabel: string;
  statusTone: Tone;
};

const th = "px-3 py-1.5 text-left text-xs font-medium text-muted-foreground";
const thR = "px-3 py-1.5 text-right text-xs font-medium text-muted-foreground";

export function InventoryTable({
  rows,
  summary,
  empty,
}: {
  rows: InvRow[];
  summary: SummaryStat[];
  empty: string;
}) {
  const router = useRouter();
  const [receiving, setReceiving] = useState(false);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  function submit(variantId: string) {
    const n = parseInt(qty[variantId] ?? "", 10);
    if (!Number.isFinite(n) || n <= 0) return;
    start(async () => {
      const res = await receiveStock(variantId, n);
      if (res.ok) {
        setQty((q) => ({ ...q, [variantId]: "" }));
        router.refresh();
      } else {
        alert(res.error);
      }
    });
  }

  return (
    <div className="px-5 pb-6 pt-2">
      <div className="flex items-center justify-between py-2 pb-4">
        <div>
          <h1 className="text-xl font-[650] tracking-[-0.2px]">Inventory</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Every variant, lowest stock first.</p>
        </div>
        <button
          type="button"
          onClick={() => setReceiving((v) => !v)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
            receiving
              ? "border border-border bg-card text-muted-foreground shadow-[0_1px_0_rgba(26,26,26,0.07)] hover:bg-muted"
              : "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(0,0,0,0.25),0_1px_0_rgba(26,26,26,0.07)] hover:bg-[#1a1917]"
          )}
        >
          {receiving ? "Done" : <><Plus weight="duotone" className="size-4" /> Receive stock</>}
        </button>
      </div>

      <div className="overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_1px_0_rgba(26,26,26,0.07)]">
        {/* Summary strip */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-border px-4 py-2.5">
          {summary.map((s) => (
            <span key={s.label} className="text-[13px] text-muted-foreground">
              <span className={cn("nums font-[650]", s.tone)}>{s.n}</span> {s.label}
            </span>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className={cn(th, "pl-4")}>Product</th>
                <th className={th}>SKU</th>
                <th className={thR}>On hand</th>
                <th className={thR}>Available</th>
                <th className={th}>Status</th>
                <th className={cn(thR, receiving ? "" : "pr-4")}>Price</th>
                {receiving ? <th className={cn(thR, "pr-4")}>Receive</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={receiving ? 7 : 6} className="px-4 py-16 text-center text-[13px] text-muted-foreground">
                    {empty}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-accent transition-colors hover:bg-muted">
                    <td className="py-1.5 pl-4 pr-3 font-medium">
                      {r.name} <span className="font-normal text-[#B5B2AC]">{r.meta}</span>
                    </td>
                    <td className="nums px-3 py-1.5 text-[12px] text-[#B5B2AC]">{r.sku}</td>
                    <td className="nums px-3 py-1.5 text-right">{formatInt(r.onHand)}</td>
                    <td className={cn("nums px-3 py-1.5 text-right font-medium", r.available <= 0 && "text-destructive", r.available > 0 && r.available <= r.reorderPoint && "text-warning")}>
                      {formatInt(r.available)}
                    </td>
                    <td className="px-3 py-1.5"><Chip tone={r.statusTone}>{r.statusLabel}</Chip></td>
                    <td className={cn("nums px-3 py-1.5 text-right", receiving ? "" : "pr-4")}>
                      {r.priceMinor != null ? formatLe(r.priceMinor, 2) : "—"}
                    </td>
                    {receiving ? (
                      <td className="py-1.5 pl-3 pr-4 text-right">
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={qty[r.variantId] ?? ""}
                            onChange={(e) => setQty((q) => ({ ...q, [r.variantId]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && submit(r.variantId)}
                            placeholder="Qty"
                            className="nums h-7 w-16 rounded-lg border border-border bg-card px-2 text-right text-xs focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => submit(r.variantId)}
                            disabled={pending || !(qty[r.variantId] ?? "").trim()}
                            aria-label={`Receive ${r.name}`}
                            className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-[#1a1917] disabled:opacity-40"
                          >
                            <Check className="size-3.5" />
                          </button>
                        </span>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {receiving ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Package className="size-3.5" />
          Type a quantity on any variant and press Enter to add it to stock.
        </p>
      ) : null}
    </div>
  );
}

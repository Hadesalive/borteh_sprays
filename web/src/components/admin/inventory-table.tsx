"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Package, Plus } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { formatInt, formatLe } from "@/lib/format";
import { Chip, type Tone } from "@/components/admin/chip";
import { receiveStock } from "@/app/(dashboard)/inventory/actions";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type DataTableColumn, type DataTableSummaryStat } from "@/components/admin/data-table";

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

export function InventoryTable({
  rows,
  summary,
  empty,
}: {
  rows: InvRow[];
  summary: DataTableSummaryStat[];
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

  const baseColumns: DataTableColumn<InvRow>[] = [
    {
      header: "Product",
      render: (r) => (
        <span className="font-medium">
          {r.name} <span className="font-normal text-muted-foreground">{r.meta}</span>
        </span>
      ),
    },
    { header: "SKU", render: (r) => <span className="nums text-[12px] text-muted-foreground">{r.sku}</span> },
    { header: "On hand", align: "right", render: (r) => <span className="nums">{formatInt(r.onHand)}</span> },
    {
      header: "Available",
      align: "right",
      render: (r) => (
        <span
          className={cn(
            "nums font-medium",
            r.available <= 0 && "text-destructive",
            r.available > 0 && r.available <= r.reorderPoint && "text-warning",
          )}
        >
          {formatInt(r.available)}
        </span>
      ),
    },
    { header: "Status", render: (r) => <Chip tone={r.statusTone}>{r.statusLabel}</Chip> },
    { header: "Price", align: "right", render: (r) => <span className="nums">{r.priceMinor != null ? formatLe(r.priceMinor, 2) : "—"}</span> },
  ];

  const receiveColumn: DataTableColumn<InvRow> = {
    header: "Receive",
    align: "right",
    render: (r) => (
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
          className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          <Check className="size-3.5" />
        </button>
      </span>
    ),
  };

  const columns = receiving ? [...baseColumns, receiveColumn] : baseColumns;

  return (
    <>
      <PageHeader title="Inventory" description="Every variant, lowest stock first.">
        <button
          type="button"
          onClick={() => setReceiving((v) => !v)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
            receiving
              ? "border border-border bg-card text-muted-foreground shadow-card hover:bg-muted"
              : "bg-primary text-primary-foreground shadow-bevel hover:bg-primary/90",
          )}
        >
          {receiving ? "Done" : (
            <>
              <Plus weight="duotone" className="size-4" /> Receive stock
            </>
          )}
        </button>
      </PageHeader>

      <div className="px-5 pb-6 pt-2">
        <DataTable summary={summary} columns={columns} rows={rows} rowKey={(r) => r.id} empty={empty} />

        {receiving ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Package className="size-3.5" />
            Type a quantity on any variant and press Enter to add it to stock.
          </p>
        ) : null}
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Cards, Trash } from "@phosphor-icons/react";

import { deleteCombo, setComboActive } from "@/app/(dashboard)/combos/actions";
import { formatLe } from "@/lib/format";
import { Chip } from "@/components/admin/chip";
import { Toggle } from "@/components/admin/toggle";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";

export type ComboRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  itemCount: number;
  pairLabel: string;
  priceMinor: number;
  /** Merchant's deal price in minor units, or null when priced at the sum. */
  dealMinor: number | null;
};

export function CombosTable({ combos }: { combos: ComboRow[] }) {
  const [, start] = useTransition();

  const columns: DataTableColumn<ComboRow>[] = [
    {
      header: "Combo",
      render: (c) => (
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
            <Cards weight="duotone" className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{c.name}</div>
            <div className="nums truncate text-xs text-muted-foreground">/{c.slug}</div>
          </div>
        </div>
      ),
    },
    {
      header: "Fragrances",
      render: (c) => <span className="line-clamp-1 text-muted-foreground">{c.pairLabel || `${c.itemCount} fragrances`}</span>,
    },
    {
      header: "Pair price",
      align: "right",
      render: (c) =>
        c.dealMinor != null && c.dealMinor < c.priceMinor ? (
          <span className="nums inline-flex items-baseline gap-1.5">
            <span className="text-muted-foreground line-through">{formatLe(c.priceMinor)}</span>
            <span className="font-semibold text-success-soft-foreground">{formatLe(c.dealMinor)}</span>
          </span>
        ) : (
          <span className="nums">{formatLe(c.priceMinor)}</span>
        ),
    },
    {
      header: "Active",
      render: (c) => <Toggle defaultOn={c.active} label={`Activate ${c.name}`} onChange={(on) => start(async () => { await setComboActive(c.id, on); })} />,
    },
    { header: "Status", render: (c) => <Chip tone={c.active ? "success" : "neutral"}>{c.active ? "Active" : "Hidden"}</Chip> },
    {
      header: "",
      align: "right",
      render: (c) => (
        <div className="flex items-center justify-end gap-3">
          <Link href={`/combos/${c.id}`} className="text-sm font-medium text-primary hover:underline">Edit</Link>
          <button
            type="button"
            aria-label={`Delete ${c.name}`}
            className="text-muted-foreground transition-colors hover:text-destructive"
            onClick={() => {
              if (confirm(`Delete the ${c.name} combo? The fragrances stay in the catalog.`)) {
                start(async () => { await deleteCombo(c.id); });
              }
            }}
          >
            <Trash className="size-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="px-5 pb-6 pt-2">
      <p className="mb-3 text-xs text-muted-foreground">
        Pairs appear as &ldquo;Perfect pairs&rdquo; on the app home and &ldquo;Complete the pair&rdquo; on each fragrance&rsquo;s page — only while every item is in stock.
      </p>
      <DataTable columns={columns} rows={combos} rowKey={(c) => c.id} empty="No combos yet. Pair two fragrances to create your first." />
    </div>
  );
}

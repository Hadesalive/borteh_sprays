"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Trash } from "@phosphor-icons/react";

import { deleteBrand, setBrandFeatured } from "@/app/(dashboard)/brands/actions";
import { formatInt } from "@/lib/format";
import { StatusPill } from "@/components/admin/status-pill";
import { Toggle } from "@/components/admin/toggle";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";

export type BrandRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  featured: boolean;
  products: number;
};

function monogram(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function BrandsTable({ brands }: { brands: BrandRow[] }) {
  const [, start] = useTransition();

  const columns: DataTableColumn<BrandRow>[] = [
    {
      header: "Brand",
      render: (b) => (
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
            {monogram(b.name)}
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{b.name}</div>
            <div className="nums truncate text-xs text-muted-foreground">/{b.slug}</div>
          </div>
        </div>
      ),
    },
    { header: "Products", align: "right", render: (b) => <span className="nums text-muted-foreground">{formatInt(b.products)}</span> },
    {
      header: "Featured on home",
      render: (b) => (
        <Toggle defaultOn={b.featured} label={`Feature ${b.name} on home`} onChange={(on) => start(async () => { await setBrandFeatured(b.id, on); })} />
      ),
    },
    { header: "Status", render: (b) => <StatusPill tone={b.active ? "success" : "neutral"} dot>{b.active ? "Active" : "Hidden"}</StatusPill> },
    {
      header: "",
      align: "right",
      render: (b) => (
        <div className="flex items-center justify-end gap-3">
          <Link href={`/brands/${b.slug}`} className="text-sm font-medium text-primary hover:underline">Edit</Link>
          <button
            type="button"
            aria-label={`Delete ${b.name}`}
            className="text-muted-foreground transition-colors hover:text-destructive"
            onClick={() => {
              if (confirm(`Delete ${b.name}? Its products stay, but it leaves the catalog.`)) {
                start(async () => { await deleteBrand(b.id); });
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
      <p className="mb-3 text-xs text-muted-foreground">Featured brands appear in the app&rsquo;s &ldquo;Shop by brand&rdquo; rail, in this order.</p>
      <DataTable columns={columns} rows={brands} rowKey={(b) => b.id} empty="No brands yet. Add your first one." />
    </div>
  );
}

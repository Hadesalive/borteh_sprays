"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Stack, Trash } from "@phosphor-icons/react";

import { deleteCollection, setCollectionFeatured } from "@/app/(dashboard)/collections/actions";
import { formatInt } from "@/lib/format";
import { Chip } from "@/components/admin/chip";
import { Toggle } from "@/components/admin/toggle";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";

export type CollectionRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  featured: boolean;
  products: number;
};

export function CollectionsTable({ collections }: { collections: CollectionRow[] }) {
  const [, start] = useTransition();

  const columns: DataTableColumn<CollectionRow>[] = [
    {
      header: "Collection",
      render: (c) => (
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
            <Stack weight="duotone" className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{c.name}</div>
            <div className="nums truncate text-xs text-muted-foreground">/{c.slug}</div>
          </div>
        </div>
      ),
    },
    { header: "Products", align: "right", render: (c) => <span className="nums text-muted-foreground">{formatInt(c.products)}</span> },
    {
      header: "On home",
      render: (c) => (
        <Toggle defaultOn={c.featured} label={`Feature ${c.name} on home`} onChange={(on) => start(async () => { await setCollectionFeatured(c.id, on); })} />
      ),
    },
    { header: "Status", render: (c) => <Chip tone={c.active ? "success" : "neutral"}>{c.active ? "Active" : "Hidden"}</Chip> },
    {
      header: "",
      align: "right",
      render: (c) => (
        <div className="flex items-center justify-end gap-3">
          <Link href={`/collections/${c.slug}`} className="text-sm font-medium text-primary hover:underline">Edit</Link>
          <button
            type="button"
            aria-label={`Delete ${c.name}`}
            className="text-muted-foreground transition-colors hover:text-destructive"
            onClick={() => {
              if (confirm(`Delete the ${c.name} collection? Products stay in the catalog.`)) {
                start(async () => { await deleteCollection(c.id); });
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
      <p className="mb-3 text-xs text-muted-foreground">Featured collections appear on the app home, in this order.</p>
      <DataTable columns={columns} rows={collections} rowKey={(c) => c.id} empty="No collections yet. Add your first one." />
    </div>
  );
}

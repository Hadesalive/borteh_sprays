"use client";

import Link from "next/link";
import { useTransition } from "react";
import { DotsSixVertical, Trash } from "@phosphor-icons/react";

import { deleteBrand, setBrandFeatured } from "@/app/(dashboard)/brands/actions";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/admin/status-pill";
import { Toggle } from "@/components/admin/toggle";

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
  const [pending, start] = useTransition();

  return (
    <div className={cn("overflow-x-auto", pending && "opacity-60 transition-opacity")}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="w-8 px-6 py-2.5 lg:px-10" />
            <th className="px-3 py-2.5 font-medium">Brand</th>
            <th className="px-3 py-2.5 text-right font-medium">Products</th>
            <th className="px-3 py-2.5 font-medium">Featured on home</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-6 py-2.5 lg:px-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border border-t border-border">
          {brands.map((b) => (
            <tr key={b.id} className="group transition-colors hover:bg-muted/40">
              <td className="px-6 py-3.5 lg:px-10">
                <DotsSixVertical className="size-4 cursor-grab text-muted-foreground/50 group-hover:text-muted-foreground" aria-label="Drag to reorder" />
              </td>
              <td className="px-3 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                    {monogram(b.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{b.name}</div>
                    <div className="nums truncate text-xs text-muted-foreground">/{b.slug}</div>
                  </div>
                </div>
              </td>
              <td className="nums px-3 py-3.5 text-right text-muted-foreground">{formatInt(b.products)}</td>
              <td className="px-3 py-3.5">
                <Toggle
                  defaultOn={b.featured}
                  label={`Feature ${b.name} on home`}
                  onChange={(on) => start(async () => { await setBrandFeatured(b.id, on); })}
                />
              </td>
              <td className="px-3 py-3.5">
                <StatusPill tone={b.active ? "success" : "neutral"} dot>
                  {b.active ? "Active" : "Hidden"}
                </StatusPill>
              </td>
              <td className="px-6 py-3.5 text-right lg:px-10">
                <div className="flex items-center justify-end gap-3">
                  <Link href={`/brands/${b.slug}`} className="text-sm font-medium text-primary hover:underline">
                    Edit
                  </Link>
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
              </td>
            </tr>
          ))}
          {brands.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-16 text-center text-sm text-muted-foreground lg:px-10">
                No brands yet. Add your first one.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

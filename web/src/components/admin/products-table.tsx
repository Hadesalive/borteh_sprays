"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MagnifyingGlass, Plus, Warning } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { formatInt, formatLe } from "@/lib/format";
import { Chip, type Tone } from "@/components/admin/chip";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type DataTableColumn, type DataTableSummaryStat } from "@/components/admin/data-table";

export type ProductRow = {
  id: string;
  name: string;
  brand: string;
  family: string | null;
  fromPriceMinor: number | null;
  band: "in_stock" | "low" | "out" | null;
  active: boolean;
  featured: boolean;
  variantCount: number;
};

const BAND: Record<string, { label: string; tone: Tone }> = {
  in_stock: { label: "In stock", tone: "success" },
  low: { label: "Low", tone: "warning" },
  out: { label: "Out", tone: "danger" },
  none: { label: "No stock", tone: "neutral" },
};

const selectClass =
  "h-8 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none";

export function ProductsTable({
  rows,
  summary,
  empty,
}: {
  rows: ProductRow[];
  summary: DataTableSummaryStat[];
  empty: string;
}) {
  const [q, setQ] = useState("");
  const [band, setBand] = useState<"all" | "in_stock" | "low" | "out">("all");
  const [active, setActive] = useState<"all" | "active" | "hidden">("all");
  const [needsOnly, setNeedsOnly] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle && !`${r.name} ${r.brand} ${r.family ?? ""}`.toLowerCase().includes(needle)) return false;
      if (band !== "all") {
        const b = r.band ?? "out"; // treat "no stock" as out for filtering
        if (b !== band) return false;
      }
      if (active === "active" && !r.active) return false;
      if (active === "hidden" && r.active) return false;
      if (needsOnly && r.family) return false;
      return true;
    });
  }, [rows, q, band, active, needsOnly]);

  const columns: DataTableColumn<ProductRow>[] = [
    {
      header: "Product",
      render: (r) => (
        <>
          <Link href={`/products/${r.id}`} className="font-medium text-foreground hover:text-brand hover:underline">
            {r.name}
          </Link>{" "}
          <span className="font-normal text-muted-foreground">{r.brand}</span>
        </>
      ),
    },
    {
      header: "Scent family",
      render: (r) =>
        r.family ? (
          <span className="text-muted-foreground">{r.family}</span>
        ) : (
          <Chip tone="warning">Needs family</Chip>
        ),
    },
    {
      header: "Stock",
      render: (r) => {
        const b = BAND[r.band ?? "none"];
        return <Chip tone={b.tone}>{b.label}</Chip>;
      },
    },
    {
      header: "Variants",
      align: "right",
      render: (r) => <span className="nums text-muted-foreground">{formatInt(r.variantCount)}</span>,
    },
    {
      header: "From",
      align: "right",
      render: (r) => <span className="nums">{r.fromPriceMinor != null ? formatLe(r.fromPriceMinor, 2) : "—"}</span>,
    },
    {
      header: "Status",
      render: (r) => <Chip tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Hidden"}</Chip>,
    },
  ];

  const summaryWithFiltered: DataTableSummaryStat[] =
    filtered.length !== rows.length
      ? [...summary, { n: formatInt(filtered.length), label: "shown", tone: "text-foreground" }]
      : summary;

  return (
    <>
      <PageHeader
        title="Products"
        description="The catalog that feeds the app and the recommendations. A scent family is required for a product to be recommended."
      >
        <Link
          href="/products/new"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-bevel transition-colors hover:bg-primary/90"
        >
          <Plus weight="duotone" className="size-4" /> New product
        </Link>
      </PageHeader>

      <div className="px-5 pb-6 pt-2">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, brand, family…"
              className="h-8 w-64 rounded-lg border border-border bg-card pl-8 pr-3 text-[13px] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
            />
          </div>
          <select className={selectClass} value={band} onChange={(e) => setBand(e.target.value as typeof band)} aria-label="Filter by stock">
            <option value="all">All stock</option>
            <option value="in_stock">In stock</option>
            <option value="low">Low</option>
            <option value="out">Out</option>
          </select>
          <select className={selectClass} value={active} onChange={(e) => setActive(e.target.value as typeof active)} aria-label="Filter by status">
            <option value="all">Active & hidden</option>
            <option value="active">Active only</option>
            <option value="hidden">Hidden only</option>
          </select>
          <button
            type="button"
            onClick={() => setNeedsOnly((v) => !v)}
            aria-pressed={needsOnly}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors",
              needsOnly
                ? "border-warning-soft bg-warning-soft text-warning-soft-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            <Warning weight="duotone" className="size-4" />
            Needs a family
          </button>
        </div>

        <DataTable
          summary={summaryWithFiltered}
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          empty={rows.length === 0 ? empty : "No products match these filters."}
        />
      </div>
    </>
  );
}

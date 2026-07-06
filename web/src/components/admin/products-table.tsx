"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MagnifyingGlass, Plus, Warning } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { formatInt, formatLe } from "@/lib/format";
import { Chip, type Tone } from "@/components/admin/chip";
import type { SummaryStat } from "@/components/admin/orders-table";

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

const th = "px-3 py-1.5 text-left text-xs font-medium text-muted-foreground";
const thR = "px-3 py-1.5 text-right text-xs font-medium text-muted-foreground";

const selectClass =
  "h-8 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none";

export function ProductsTable({
  rows,
  summary,
  empty,
}: {
  rows: ProductRow[];
  summary: SummaryStat[];
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

  return (
    <div className="px-5 pb-6 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3 py-2 pb-4">
        <div>
          <h1 className="text-xl font-[650] tracking-[-0.2px]">Products</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The catalog that feeds the app and the recommendations. A scent family is required for a product to be recommended.
          </p>
        </div>
        <Link
          href="/products/new"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(0,0,0,0.25),0_1px_0_rgba(26,26,26,0.07)] transition-colors hover:bg-[#1a1917]"
        >
          <Plus weight="duotone" className="size-4" /> New product
        </Link>
      </div>

      {/* Toolbar */}
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
              : "border-border bg-card text-muted-foreground hover:bg-muted"
          )}
        >
          <Warning weight="duotone" className="size-4" />
          Needs a family
        </button>
      </div>

      <div className="overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_1px_0_rgba(26,26,26,0.07)]">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-border px-4 py-2.5">
          {summary.map((s) => (
            <span key={s.label} className="text-[13px] text-muted-foreground">
              <span className={cn("nums font-[650]", s.tone)}>{s.n}</span> {s.label}
            </span>
          ))}
          {filtered.length !== rows.length ? (
            <span className="text-[13px] text-muted-foreground">
              · <span className="nums font-[650] text-foreground">{formatInt(filtered.length)}</span> shown
            </span>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className={cn(th, "pl-4")}>Product</th>
                <th className={th}>Scent family</th>
                <th className={th}>Stock</th>
                <th className={thR}>Variants</th>
                <th className={cn(thR, "pr-4")}>From</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-[13px] text-muted-foreground">
                    {rows.length === 0 ? empty : "No products match these filters."}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const b = BAND[r.band ?? "none"];
                  return (
                    <tr key={r.id} className="border-t border-accent transition-colors hover:bg-muted">
                      <td className="py-1.5 pl-4 pr-3">
                        <Link href={`/products/${r.id}`} className="font-medium text-foreground hover:text-brand hover:underline">
                          {r.name}
                        </Link>{" "}
                        <span className="font-normal text-[#B5B2AC]">{r.brand}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        {r.family ? (
                          <span className="text-muted-foreground">{r.family}</span>
                        ) : (
                          <Chip tone="warning">Needs family</Chip>
                        )}
                      </td>
                      <td className="px-3 py-1.5"><Chip tone={b.tone}>{b.label}</Chip></td>
                      <td className="nums px-3 py-1.5 text-right text-muted-foreground">{formatInt(r.variantCount)}</td>
                      <td className="nums px-3 py-1.5 pr-4 text-right">{r.fromPriceMinor != null ? formatLe(r.fromPriceMinor, 2) : "—"}</td>
                      <td className="px-3 py-1.5">
                        <Chip tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Hidden"}</Chip>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

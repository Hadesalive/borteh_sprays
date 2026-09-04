# Admin Redesign — Wave 1 (Lists & Order Detail) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Products and Inventory onto the Wave 0 shared components (`PageHeader`, `DataTable`), add missing `loading.tsx`/`error.tsx` to all three route segments (Orders detail, Products, Inventory), and fix two real correctness bugs (a developer-facing error string, and two list pages silently swallowing query failures instead of surfacing them).

**Architecture:** `ProductsTable`/`InventoryTable` are already `"use client"` components that own their own header today (unlike Orders, where the header lived in the server page) — this wave keeps that ownership boundary rather than restructuring it, and renders `PageHeader` *inside* each client component, full-bleed, exactly matching the padding-correct pattern the Wave 0 final review fixed on Overview/Orders (never nest `PageHeader` inside a padded wrapper — the wrapper padding goes on the content *below* the header only). Both tables' hand-rolled Card+table shells become `DataTable` usages, following `orders-table.tsx` (already migrated in Wave 0) as the reference implementation.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), Tailwind v4, shadcn/ui, Vitest + Testing Library (`npm test`).

**Spec:** `docs/superpowers/specs/2026-09-02-admin-redesign-design.md`. This plan implements part of the spec's "Wave 1 — Core operations" (Orders detail, Products, Inventory). **Product detail** (`products/[id]/page.tsx` and its 6 sub-components) is explicitly OUT of scope for this plan — it needs its own plan (a `FormField`/`FormSection` conversion of a 307-line stateful form, a 6-component Card/CardHeader consolidation, and a new tabs restructuring are each substantial enough to deserve their own review cycle; bundling them here would produce an unreviewable plan). Products list, Products detail, and Inventory were grouped as one wave in the spec's original rollout table — this plan splits that grouping into "the mechanical, lower-risk half" (this plan) and "the product-detail deep dive" (separate, follow-up plan), matching the same reasoning that scoped Wave 0 down from the full spec in the first place.

## Global Constraints

- Every file this plan touches lives under `web/` — no `mobile/` or `supabase/` changes, no new migrations.
- Reuse Wave 0's shared components exactly as they exist today — do not modify `page-header.tsx`, `data-table.tsx`, `empty-state.tsx`, or any other Wave 0 component. If a task seems to need a change to one of them, stop and report BLOCKED rather than editing a component other pages already depend on.
- `PageHeader` renders full-bleed (never nested inside a `px-5 pb-6 pt-2`-style padded wrapper) — this is the exact bug the Wave 0 final review found and fixed on Overview/Orders; do not reintroduce it here.
- Every hardcoded hex color (`text-[#...]`, `bg-[#...]`) and hardcoded shadow (`shadow-[...]`) touched by a task's target file must become the corresponding token/utility (`text-muted-foreground`, `shadow-card`, `shadow-bevel`, `hover:bg-primary/90`) — this repo's own acceptance criterion is `grep -rn "shadow-\[\|rounded-\[\|text-\[#\|bg-\[#" web/src/app web/src/components/admin` returning nothing outside files not yet migrated.
- `rounded-lg`/`rounded-md` classes that already exist in a file being touched do NOT need to change — they're token-derived (`--radius-lg`/`--radius-md` both resolve to `0` since Wave 0), so they already render square. Only literal arbitrary-value hex/shadow classes need replacing.
- Run `npx tsc --noEmit` (from `web/`) after every task — must be clean before moving to the next task.
- Run `npm test` (from `web/`) after every task — full suite must pass.

---

## File Structure

Modified files:
- `web/src/components/admin/products-table.tsx` — full rewrite onto `DataTable` + `PageHeader`
- `web/src/app/(dashboard)/products/page.tsx` — throw on query error instead of swallowing it into a dev-facing string
- `web/src/components/admin/inventory-table.tsx` — full rewrite onto `DataTable` + `PageHeader`
- `web/src/app/(dashboard)/inventory/page.tsx` — throw on query error; switch `SummaryStat` import to `DataTableSummaryStat`

New files:
- `web/src/components/admin/products-table.test.tsx`
- `web/src/components/admin/inventory-table.test.tsx`
- `web/src/app/(dashboard)/orders/[id]/loading.tsx`
- `web/src/app/(dashboard)/orders/[id]/error.tsx`
- `web/src/app/(dashboard)/products/loading.tsx`
- `web/src/app/(dashboard)/products/error.tsx`
- `web/src/app/(dashboard)/inventory/loading.tsx`
- `web/src/app/(dashboard)/inventory/error.tsx`

Explicitly NOT touched: `web/src/app/(dashboard)/orders/[id]/page.tsx` itself (already clean — no hardcoded hex/shadow, already uses `Card` — confirmed by direct inspection; this wave only adds its missing `loading.tsx`/`error.tsx` siblings), `products/[id]/*`, `products/new/page.tsx`, any of the 6 `product-*.tsx` sub-components (all deferred to the follow-up plan).

---

### Task 1: Orders detail — `loading.tsx` + `error.tsx`

**Files:**
- Create: `web/src/app/(dashboard)/orders/[id]/loading.tsx`
- Create: `web/src/app/(dashboard)/orders/[id]/error.tsx`

**Interfaces:**
- Consumes: `Skeleton` (`@/components/ui/skeleton`, already exists), `PageError` (`@/components/admin/page-error`, already exists — same component every other route's `error.tsx` uses).

- [ ] **Step 1: Write the loading skeleton, shaped to the actual page layout**

The real page (`orders/[id]/page.tsx`, unmodified by this task) renders: a back-link, a header row (title+chip on the left, an action on the right), then a two-column grid (`lg:grid-cols-[1.6fr_1fr]`) — left column has an Items card and a Delivery/Pickup card; right column has a Status-timeline card, a Payment card, and a Customer card. Create `web/src/app/(dashboard)/orders/[id]/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function OrderDetailLoading() {
  return (
    <div className="px-5 pb-6 pt-2">
      <Skeleton className="h-3.5 w-16" />

      <div className="flex items-start justify-between py-2 pb-6">
        <div>
          <Skeleton className="h-6 w-28" />
          <Skeleton className="mt-2 h-3 w-56" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-card" />
          <Skeleton className="h-36 w-full rounded-card" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-card" />
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-36 w-full rounded-card" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the error boundary**

Create `web/src/app/(dashboard)/orders/[id]/error.tsx`, matching the exact 6-line pattern every other route's `error.tsx` already uses (e.g. `web/src/app/(dashboard)/orders/error.tsx`):

```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function OrderDetailError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load this order" reset={reset} />;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manually verify the skeleton renders sensibly**

Run: `npm run dev`, sign in, open any real order's detail page, then hard-refresh with network throttled (DevTools → Network → Slow 3G, or just trust the skeleton's shape by eye against the loaded page) to confirm the skeleton's proportions roughly match the loaded content — this is a judgment call, not a pixel-exact requirement.

- [ ] **Step 5: Commit**

```bash
git add "web/src/app/(dashboard)/orders/[id]/loading.tsx" "web/src/app/(dashboard)/orders/[id]/error.tsx"
git commit -m "feat(admin): add loading/error states to Order detail

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Products — migrate onto `DataTable` + `PageHeader`, fix error handling

**Files:**
- Modify: `web/src/components/admin/products-table.tsx` (full rewrite)
- Modify: `web/src/app/(dashboard)/products/page.tsx`
- Create: `web/src/components/admin/products-table.test.tsx`
- Create: `web/src/app/(dashboard)/products/loading.tsx`
- Create: `web/src/app/(dashboard)/products/error.tsx`

**Interfaces:**
- Consumes: `DataTable`, `DataTableColumn<T>`, `DataTableSummaryStat` (`@/components/admin/data-table`), `PageHeader` (`@/components/admin/page-header`), both from Wave 0, unchanged.
- Produces: `ProductsTable({ rows, summary, empty }: { rows: ProductRow[]; summary: DataTableSummaryStat[]; empty: string })` — same prop names as before, `summary`'s type changes from the ad hoc `SummaryStat` (re-exported from `orders-table.tsx`) to `DataTableSummaryStat` (same shape, different import source — `products/page.tsx` doesn't explicitly type its `summary` const today, so this is a non-breaking change for that call site).

- [ ] **Step 1: Write the failing test**

Create `web/src/components/admin/products-table.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductsTable, type ProductRow } from "@/components/admin/products-table";

const rows: ProductRow[] = [
  {
    id: "1",
    name: "Midnight Oud",
    brand: "Acme",
    family: "Woody",
    fromPriceMinor: 74000,
    band: "in_stock",
    active: true,
    featured: false,
    variantCount: 2,
  },
];

describe("ProductsTable", () => {
  it("renders product rows without any hardcoded hex colors", () => {
    const { container } = render(<ProductsTable rows={rows} summary={[]} empty="No products." />);
    expect(screen.getByText("Midnight Oud")).toBeInTheDocument();
    expect(container.innerHTML.replace(/\sclass="[^"]*"/g, "")).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it("shows the empty state copy when there are no products", () => {
    render(<ProductsTable rows={[]} summary={[]} empty="No products yet." />);
    expect(screen.getByText("No products yet.")).toBeInTheDocument();
  });

  it("shows a warning chip instead of the scent family when one is missing", () => {
    const missingFamily: ProductRow[] = [{ ...rows[0], family: null }];
    render(<ProductsTable rows={missingFamily} summary={[]} empty="No products." />);
    expect(screen.getByText("Needs family")).toBeInTheDocument();
  });

  it("filters rows by the search box", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const two: ProductRow[] = [rows[0], { ...rows[0], id: "2", name: "Rose Garden" }];
    render(<ProductsTable rows={two} summary={[]} empty="No products." />);
    await userEvent.type(screen.getByPlaceholderText("Search name, brand, family…"), "Rose");
    expect(screen.queryByText("Midnight Oud")).not.toBeInTheDocument();
    expect(screen.getByText("Rose Garden")).toBeInTheDocument();
  });
});
```

(The hex-color test uses the same `class="..."`-stripping approach Wave 0's `revenue-chart.test.tsx` established, for the same reason: this file's `DataTable`/`Card` ancestry can carry vendor/utility class text that isn't a color our code chose. Here it's mainly a precaution — this file doesn't pull in shadcn's chart primitives — but keeps the test consistent with the codebase's established pattern rather than reinventing a narrower one.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/products-table.test.tsx`
Expected: FAIL — module exists but still has the 3 hardcoded hex/shadow occurrences and hand-rolled markup instead of `DataTable`.

- [ ] **Step 3: Rewrite `products-table.tsx`**

Replace `web/src/components/admin/products-table.tsx` in full:

```tsx
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
```

Notes on deliberate adaptations from the original file (not oversights — confirm these read as intentional in review):
- The toolbar (search + 2 selects + the "Needs a family" toggle) moved from being its own bordered strip above the table to being plain content above `DataTable` (not passed into `DataTable`'s `search` slot) — this is because `ProductsTable`'s toolbar already reads fine as page-level content and doesn't need `DataTable`'s bordered-strip treatment the way Orders' more compact toolbar did; either placement is defensible, but keep it as page-level content here to avoid `DataTable`'s `search` slot growing an unusually tall, multi-row toolbar. If a reviewer disagrees and wants it inside `DataTable`'s `search` prop instead (matching Orders' pattern exactly), that's a one-line change — flag it, don't silently redo it.
- The "· N shown" inline filtered-count text is now a plain appended `DataTableSummaryStat` entry rather than custom inline markup — same information, rendered through `DataTable`'s existing summary-strip styling instead of a bespoke one-off.
- Row navigation stays `<Link>`-per-cell (as it already was) rather than `DataTable`'s `onRowClick` — this is deliberately kept, not changed: a `<Link>` is keyboard-accessible by default, `onRowClick` (used by the already-migrated `OrdersTable`) is not. Do not "fix" this to match Orders — Orders' own accessibility gap here is a known, separately-tracked issue, not a pattern to propagate.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/admin/products-table.test.tsx`
Expected: PASS, 4/4.

- [ ] **Step 5: Fix `products/page.tsx`'s error handling**

The current file swallows a Supabase query failure into a developer-facing empty-state string (`"Couldn't load products — check the Supabase keys in web/.env.local."`) instead of throwing, so the route's forthcoming `error.tsx` (this task, Step 6) would never actually catch it — this is a real bug, not just a copy problem, matching the exact anti-pattern the July spec's original audit flagged and fixed for the Orders page (see `docs/superpowers/specs/2026-07-10-web-admin-redesign-design.md`, "Two smaller defects... `orders/page.tsx:88` renders, on query failure, the subtitle... This is shown to the shop owner"). Modify `web/src/app/(dashboard)/products/page.tsx`:

```tsx
import { createServerClient } from "@/lib/supabase/server";
import { formatInt } from "@/lib/format";
import { ProductsTable, type ProductRow } from "@/components/admin/products-table";

export const dynamic = "force-dynamic";

type Band = "in_stock" | "low" | "out";

type VariantRow = {
  price_minor: number | null;
  is_active: boolean | null;
  deleted_at: string | null;
  availability_signal: { band: Band } | { band: Band }[] | null;
};

type ProductRecord = {
  id: string;
  name: string | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  scent_family: string | null;
  brand: { name: string | null } | { name: string | null }[] | null;
  product_variant: VariantRow[] | null;
};

/** availability_signal / brand come back as an object (1:1) or a single-element array. */
function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

/** A product's band is its best variant: any in-stock → in_stock, else any low → low, else out. */
function rollupBand(bands: Band[]): Band | null {
  if (bands.length === 0) return null;
  if (bands.includes("in_stock")) return "in_stock";
  if (bands.includes("low")) return "low";
  return "out";
}

export default async function ProductsPage() {
  const db = createServerClient();
  const { data, error } = await db
    .from("product")
    .select(
      "id, name, is_active, is_featured, scent_family, brand(name), product_variant(price_minor, is_active, deleted_at, availability_signal(band))"
    )
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw error;

  const records = (data ?? []) as unknown as ProductRecord[];

  const rows: ProductRow[] = records.map((p) => {
    const variants = (p.product_variant ?? []).filter((v) => !v.deleted_at);
    const live = variants.filter((v) => v.is_active !== false);
    const priced = (live.length ? live : variants)
      .map((v) => v.price_minor)
      .filter((n): n is number => typeof n === "number");
    const bands = (live.length ? live : variants)
      .map((v) => one(v.availability_signal)?.band)
      .filter((b): b is Band => b === "in_stock" || b === "low" || b === "out");

    return {
      id: p.id,
      name: p.name ?? "Untitled product",
      brand: one(p.brand)?.name ?? "—",
      family: p.scent_family?.trim() || null,
      fromPriceMinor: priced.length ? Math.min(...priced) : null,
      band: rollupBand(bands),
      active: p.is_active !== false,
      featured: p.is_featured === true,
      variantCount: variants.length,
    };
  });

  const needsAttention = rows.filter((r) => !r.family).length;
  const outOfStock = rows.filter((r) => r.band === "out" || r.band === null).length;

  const summary = [
    { n: formatInt(rows.length), label: "products", tone: "text-foreground" },
    { n: formatInt(rows.filter((r) => r.active).length), label: "active", tone: "text-foreground" },
    { n: formatInt(needsAttention), label: "need a scent family", tone: needsAttention ? "text-warning" : "text-foreground" },
    { n: formatInt(outOfStock), label: "out of stock", tone: outOfStock ? "text-destructive" : "text-foreground" },
  ];

  return <ProductsTable rows={rows} summary={summary} empty="No products yet." />;
}
```

(Only the `if (error) throw error;` addition and the simplified final `return`'s `empty="No products yet."` changed — everything else in this file is unchanged.)

- [ ] **Step 6: Add `loading.tsx` and `error.tsx` for the Products route**

Create `web/src/app/(dashboard)/products/loading.tsx`, following the exact pattern `orders/loading.tsx` established (list page, `TableSkeleton`):

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/admin/table-skeleton";

export default function ProductsLoading() {
  return (
    <div className="px-5 pb-6 pt-2">
      <div className="flex items-center justify-between py-2 pb-4">
        <div>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-1.5 h-3 w-80" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
      <TableSkeleton columns={6} rows={10} />
    </div>
  );
}
```

Create `web/src/app/(dashboard)/products/error.tsx`:

```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function ProductsError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load products" reset={reset} />;
}
```

- [ ] **Step 7: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass (including the 4 new `products-table.test.tsx` tests).

- [ ] **Step 8: Manually verify**

Run: `npm run dev`, sign in, open `/products`. Confirm: header matches Overview/Orders' typography and full-bleed alignment exactly, table renders with square corners, search/filters still work, clicking a product name still navigates to its detail page, "New product" button still works.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/admin/products-table.tsx web/src/components/admin/products-table.test.tsx "web/src/app/(dashboard)/products/page.tsx" "web/src/app/(dashboard)/products/loading.tsx" "web/src/app/(dashboard)/products/error.tsx"
git commit -m "feat(admin): migrate Products to PageHeader + DataTable, fix swallowed query errors

ProductsTable now composes DataTable instead of hand-rolling its own
Card+table shell, killing 3 hardcoded hex/shadow occurrences. Products
page now throws on a Supabase query failure instead of showing a
developer-facing 'check the Supabase keys' string to the shop owner —
the new error.tsx catches it properly, matching the pattern already
fixed on Orders.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Inventory — migrate onto `DataTable` + `PageHeader`, fix error handling

**Files:**
- Modify: `web/src/components/admin/inventory-table.tsx` (full rewrite)
- Modify: `web/src/app/(dashboard)/inventory/page.tsx`
- Create: `web/src/components/admin/inventory-table.test.tsx`
- Create: `web/src/app/(dashboard)/inventory/loading.tsx`
- Create: `web/src/app/(dashboard)/inventory/error.tsx`

**Interfaces:**
- Consumes: `DataTable`, `DataTableColumn<T>`, `DataTableSummaryStat` (`@/components/admin/data-table`), `PageHeader` (`@/components/admin/page-header`).
- Produces: `InventoryTable({ rows, summary, empty }: { rows: InvRow[]; summary: DataTableSummaryStat[]; empty: string })` — same prop names as before.

- [ ] **Step 1: Write the failing test**

Create `web/src/components/admin/inventory-table.test.tsx`. `InventoryTable` calls `useRouter()` (for `router.refresh()` after receiving stock), so — same as Wave 0's `orders-table.test.tsx` had to do — this needs a `next/navigation` mock:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryTable, type InvRow } from "@/components/admin/inventory-table";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const rows: InvRow[] = [
  {
    id: "1",
    variantId: "v1",
    name: "Midnight Oud",
    meta: "Acme · 50 ml",
    sku: "MO-050",
    onHand: 12,
    available: 10,
    reorderPoint: 5,
    priceMinor: 74000,
    statusLabel: "In stock",
    statusTone: "success",
  },
];

describe("InventoryTable", () => {
  it("renders rows without any hardcoded hex colors", () => {
    const { container } = render(<InventoryTable rows={rows} summary={[]} empty="No inventory." />);
    expect(screen.getByText("Midnight Oud")).toBeInTheDocument();
    expect(container.innerHTML.replace(/\sclass="[^"]*"/g, "")).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it("shows the empty state copy when there are no rows", () => {
    render(<InventoryTable rows={[]} summary={[]} empty="No inventory items yet." />);
    expect(screen.getByText("No inventory items yet.")).toBeInTheDocument();
  });

  it("has no Receive column until 'Receive stock' is toggled on", () => {
    render(<InventoryTable rows={rows} summary={[]} empty="No inventory." />);
    expect(screen.queryByPlaceholderText("Qty")).not.toBeInTheDocument();
  });

  it("shows a Qty input per row after toggling 'Receive stock' on", async () => {
    render(<InventoryTable rows={rows} summary={[]} empty="No inventory." />);
    await userEvent.click(screen.getByRole("button", { name: "Receive stock" }));
    expect(screen.getByPlaceholderText("Qty")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/inventory-table.test.tsx`
Expected: FAIL — file still has 6 hardcoded hex/shadow occurrences and hand-rolled markup.

- [ ] **Step 3: Rewrite `inventory-table.tsx`**

Replace `web/src/components/admin/inventory-table.tsx` in full:

```tsx
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/admin/inventory-table.test.tsx`
Expected: PASS, 4/4.

- [ ] **Step 5: Fix `inventory/page.tsx`'s error handling and `SummaryStat` import**

Same swallowed-error problem as Products: `invRes.error` is checked only to pick between two hand-written strings, never thrown, so `error.tsx` (Step 6) would never actually trigger for a real query failure. Modify `web/src/app/(dashboard)/inventory/page.tsx`:

```tsx
import { createServerClient } from "@/lib/supabase/server";
import { formatInt, formatLe } from "@/lib/format";
import { type Tone } from "@/components/admin/chip";
import { InventoryTable, type InvRow } from "@/components/admin/inventory-table";
import { type DataTableSummaryStat } from "@/components/admin/data-table";

export const dynamic = "force-dynamic";

type VariantRow = {
  sku: string | null;
  size_ml: number | null;
  concentration: string | null;
  price_minor: number | null;
  availability_signal: { band: string } | { band: string }[] | null;
  product: { name: string | null; brand: { name: string | null } | null } | null;
} | null;

/** availability_signal comes back as an object (1:1) or a single-element array. */
function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

type InventoryRecord = {
  id: string;
  variant_id: string;
  qty_on_hand: number | null;
  qty_reserved: number | null;
  qty_available: number | null;
  reorder_point: number | null;
  product_variant: VariantRow;
};

// Read the authoritative band from availability_signal (fn_recompute_band owns it);
// fall back to the available/reorder heuristic only if the signal row is somehow missing.
function bandStatus(band: string | null, available: number, reorderPoint: number): { label: string; tone: Tone } {
  const b = band ?? (available <= 0 ? "out" : available <= reorderPoint ? "low" : "in_stock");
  if (b === "out") return { label: "Out", tone: "danger" };
  if (b === "low") return { label: "Low", tone: "warning" };
  return { label: "In stock", tone: "success" };
}

export default async function InventoryPage() {
  const db = createServerClient();
  const [invRes, restockRes] = await Promise.all([
    db
      .from("inventory_item")
      .select("id, variant_id, qty_on_hand, qty_reserved, qty_available, reorder_point, product_variant(sku, size_ml, concentration, price_minor, availability_signal(band), product(name, brand(name)))")
      .order("qty_available", { ascending: true }),
    db.from("restock_subscription").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  if (invRes.error) throw invRes.error;

  const records = (invRes.data ?? []) as unknown as InventoryRecord[];
  const restockers = restockRes.count ?? 0;

  const rows: InvRow[] = records.map((it) => {
    const v = it.product_variant;
    const available = it.qty_available ?? 0;
    const band = one(v?.availability_signal)?.band ?? null;
    const status = bandStatus(band, available, it.reorder_point ?? 0);
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
  // Counts follow the authoritative band shown in each row's chip.
  const low = rows.filter((r) => r.statusLabel === "Low").length;
  const out = rows.filter((r) => r.statusLabel === "Out").length;

  const summary: DataTableSummaryStat[] = [
    { n: formatInt(rows.length), label: "SKUs", tone: "text-foreground" },
    { n: formatInt(unitsOnHand), label: "units on hand", tone: "text-foreground" },
    { n: formatLe(stockValue), label: "stock value", tone: "text-foreground" },
    { n: formatInt(low), label: "low", tone: "text-warning" },
    { n: formatInt(out), label: "out", tone: "text-destructive" },
    { n: formatInt(restockers), label: "restock subscribers", tone: "text-foreground" },
  ];

  return <InventoryTable rows={rows} summary={summary} empty="No inventory items yet." />;
}
```

(Changes: `import { type SummaryStat } from "@/components/admin/orders-table"` → `import { type DataTableSummaryStat } from "@/components/admin/data-table"`; `if (invRes.error) throw invRes.error;` added right after the `Promise.all`; `summary: SummaryStat[]` → `summary: DataTableSummaryStat[]`; final `return`'s `empty` prop simplified from the `invRes.error ? "..." : "..."` ternary to the plain `"No inventory items yet."` string, since a real failure now throws instead of reaching this line.)

- [ ] **Step 6: Add `loading.tsx` and `error.tsx` for the Inventory route**

Create `web/src/app/(dashboard)/inventory/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/admin/table-skeleton";

export default function InventoryLoading() {
  return (
    <div className="px-5 pb-6 pt-2">
      <div className="flex items-center justify-between py-2 pb-4">
        <div>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-1.5 h-3 w-56" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
      <TableSkeleton columns={6} rows={10} />
    </div>
  );
}
```

Create `web/src/app/(dashboard)/inventory/error.tsx`:

```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function InventoryError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load inventory" reset={reset} />;
}
```

- [ ] **Step 7: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass (including the 4 new `inventory-table.test.tsx` tests).

- [ ] **Step 8: Manually verify**

Run: `npm run dev`, sign in, open `/inventory`. Confirm: header matches the other migrated pages, table renders square-cornered, toggling "Receive stock" adds the 7th column and its input/button work end-to-end (test with a real variant if you're comfortable doing so, or confirm the UI wiring without submitting), toggling back to "Done" removes the column cleanly.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/admin/inventory-table.tsx web/src/components/admin/inventory-table.test.tsx "web/src/app/(dashboard)/inventory/page.tsx" "web/src/app/(dashboard)/inventory/loading.tsx" "web/src/app/(dashboard)/inventory/error.tsx"
git commit -m "feat(admin): migrate Inventory to PageHeader + DataTable, fix swallowed query errors

InventoryTable now composes DataTable instead of hand-rolling its own
Card+table shell, killing 6 hardcoded hex/shadow occurrences. The
receiving-mode 7th column is now a conditionally-included DataTableColumn
rather than conditional JSX inside a hand-rolled <tr>. Inventory page now
throws on a Supabase query failure instead of picking between two
hand-written strings that never actually reflected a real failure.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

(Completed during plan-writing, not left for the executor.)

- **Spec coverage:** Orders detail's missing loading/error (Task 1), Products' DataTable/PageHeader migration + hex sweep (Task 2), Inventory's DataTable/PageHeader migration + hex sweep (Task 3) all covered. The spec's broader "Wave 1" also includes Products detail (`products/[id]`) — explicitly deferred to a follow-up plan per this plan's header, not silently dropped.
- **Placeholder scan:** none found.
- **Type consistency:** `ProductRow`, `InvRow`, `DataTableColumn<T>`, `DataTableSummaryStat` are each defined once (in Wave 0's `data-table.tsx` for the last one) and referenced identically across both tasks. `SummaryStat` (the old re-export from `orders-table.tsx`) is fully retired from both `products-table.tsx`/`inventory-table.tsx` and their page callers — confirmed no remaining import of it from either file after this plan; `orders-table.tsx` itself still exports `SummaryStat` for its own internal use and is untouched by this plan.
- **Scope:** Product detail (`products/[id]/*`, all 6 sub-components, `products/new`) is explicitly out of scope — flagged at the top of this document and in the File Structure section, not discovered mid-task.

# Admin Redesign — Wave 3c (Analytics) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Analytics' three remaining hand-rolled visualizations (payment mix, order funnel, best sellers) with real `chart.tsx`/Recharts components, migrate the page's header and card shells onto the shared design system (the last file in the app with a copy-pasted `rounded-[12px]`/`shadow-[...]` card constant and raw hex literals), and migrate the best-sellers table onto `DataTable`.

**Architecture:** This is qualitatively different work from every other Wave 3 plan — it's not a mechanical CRUD/form migration, it's building three new chart components from scratch and deciding what they should look like. `RevenueChart` (the fourth visualization the spec names) is **already** on `chart.tsx` — it was built in Wave 0 and this page already reuses it; nothing about it changes here except the `Card` shell wrapping it. The three new charts (`PaymentMixChart`, `OrderFunnelChart`, `BestSellersChart`) are new, single-purpose files in `web/src/components/admin/`, following `revenue-chart.tsx`'s exact established pattern (a `ChartConfig` object, `ChartContainer`, real Recharts primitives, `var(--chart-N)`/`var(--border)`/`var(--muted-foreground)` tokens, `radius={0}` on every bar). One deliberate scoping decision: the Order Funnel uses a horizontal `BarChart`, not Recharts' literal `Funnel`/`FunnelChart` trapezoid components — see Task 1's notes for why.

**Tech Stack:** Next.js 16 App Router (Server Components), Tailwind v4, shadcn/ui, Recharts 3.8 (via `chart.tsx`), Vitest + Testing Library (`npm test`).

**Spec:** `docs/superpowers/specs/2026-09-02-admin-redesign-design.md`. Implements Problem #8 ("Analytics' charts are bespoke, low-quality markup") and the Decisions → Charts / Shared component layer → Chart primitives sections ("replace all bespoke chart markup with shadcn's `chart.tsx`... revenue trend, payment mix, funnel, best-sellers").

## Global Constraints

- Every file this plan touches lives under `web/` — no `mobile/`/`supabase/` changes, no new migrations.
- The two Supabase queries in `analytics/page.tsx` (`order`, `order_item`) stay unbounded, exactly as they are today — **this is a deliberate, disclosed scope boundary, not an oversight.** Bounding them would be a real, worthwhile fix (the same class of problem Wave 2 fixed on Customers), but this plan was scoped as "chart design work + a hex/card-shell sweep," not a data-layer pass, and the `order_item` query's current unbounded fetch is load-bearing for a real behavior (`itemBase = items7.length ? items7 : items` — an all-time fallback when the last 7 days had no sales). Bounding it casually risks silently breaking that fallback. Flagged here for a future pass, not touched by any task below.
- Do not modify `page-header.tsx`, `card.tsx`, `chart.tsx`, `data-table.tsx`, `revenue-chart.tsx`, or `export-button.tsx`.
- Every `CardTitle` this plan introduces gets `role="heading" aria-level={2}` at the call site — the established per-call-site fix from Product Detail's final review (`CardTitle` itself renders a `<div>`, and the primitive is deliberately left unfixed; every new consumer applies this itself).
- Every hardcoded hex color (`text-[#...]`, `bg-[#...]`) and hardcoded shadow/radius bracket (`shadow-[...]`, `rounded-[...]`) in `analytics/page.tsx` must become a token/utility. Acceptance check: `grep -rn "shadow-\[\|rounded-\[\|text-\[#\|bg-\[#" web/src/app/\(dashboard\)/analytics web/src/components/admin/payment-mix-chart.tsx web/src/components/admin/order-funnel-chart.tsx web/src/components/admin/best-sellers-chart.tsx` must return nothing.
- Run `npx tsc --noEmit` (from `web/`) after every task — must be clean before moving to the next task.
- Run `npm test` (from `web/`) after every task — full suite must pass.

---

## File Structure

New files:
- `web/src/components/admin/payment-mix-chart.tsx` (Task 1)
- `web/src/components/admin/order-funnel-chart.tsx` (Task 1)
- `web/src/components/admin/best-sellers-chart.tsx` (Task 1)
- `web/src/app/(dashboard)/analytics/loading.tsx`, `error.tsx` (Task 3)

Deleted files (Task 1):
- `web/src/components/dashboard/donut.tsx` — a dependency-free, hand-rolled SVG donut with **zero consumers anywhere in the codebase** (confirmed via `grep -rln "Donut" web/src --include="*.tsx" | grep -v donut.tsx` returning nothing). It references `var(--color-cream)`, a token name that predates the Wave 0 rewrite and may not even resolve to anything live anymore. This is exactly the bespoke, pre-`chart.tsx` visualization pattern the spec asks to retire, and it's dead code besides — removed rather than fixed, matching the precedent set by every other dead-code find in this redesign (Dispatch's rider UI, Collections/Brands' drag handles, the two orphaned `content/*` files from Wave 3b).

Modified files:
- `web/src/app/(dashboard)/analytics/page.tsx` — full rewrite (Task 2)

Explicitly NOT touched: `revenue-chart.tsx` (already chart.tsx-based, reused as-is), `stat-card.tsx` (its own doc comment says it's "the hero-metric pattern used once per page... never as a wall of co-equal tiles" — Analytics' 6-stat strip is a single unified card with internal dividers, not six `StatCard`s, so this component isn't used here and isn't touched), the two Supabase queries' bounding (see Global Constraints).

---

### Task 1: Three new chart components, remove the dead `Donut` component

**Files:**
- Create: `web/src/components/admin/payment-mix-chart.tsx`
- Create: `web/src/components/admin/order-funnel-chart.tsx`
- Create: `web/src/components/admin/best-sellers-chart.tsx`
- Delete: `web/src/components/dashboard/donut.tsx`

**Interfaces:**
- Consumes: `ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent` (`@/components/ui/chart`, Wave 0, unchanged), `formatLe`/`formatInt` (`@/lib/format`, unchanged), Recharts primitives (`Pie`, `PieChart`, `Cell`, `Bar`, `BarChart`, `CartesianGrid`, `XAxis`, `YAxis` — all from the `recharts` package already a dependency).
- Produces: `PaymentMixChart({codMinor, prepaidMinor}: {codMinor: number; prepaidMinor: number})`, `OrderFunnelChart({stages}: {stages: {stage: string; count: number}[]})`, `BestSellersChart({items}: {items: {name: string; minor: number}[]})` — Task 2 imports and wires all three into `analytics/page.tsx` with data it already computes.

- [ ] **Step 1: Confirm `Donut` is truly dead before deleting it**

Run: `grep -rln "Donut" web/src --include="*.tsx" --include="*.ts"`
Expected: only `web/src/components/dashboard/donut.tsx` itself. If any OTHER file imports `Donut`, stop and report BLOCKED rather than deleting a component still in use.

```bash
git rm web/src/components/dashboard/donut.tsx
```

- [ ] **Step 2: Create `payment-mix-chart.tsx`**

```tsx
"use client";

import { Cell, Pie, PieChart } from "recharts";

import { formatLe } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  cod: { label: "Cash & COD", color: "var(--chart-1)" },
  prepaid: { label: "Prepaid", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** Donut split of revenue between cash-on-delivery and prepaid orders. */
export function PaymentMixChart({ codMinor, prepaidMinor }: { codMinor: number; prepaidMinor: number }) {
  const data = [
    { key: "cod", value: codMinor },
    { key: "prepaid", value: prepaidMinor },
  ];

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square h-32" role="img" aria-label="Payment mix, cash on delivery versus prepaid">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel formatter={(value) => formatLe(Number(value))} />} />
        <Pie data={data} dataKey="value" nameKey="key" innerRadius={36} outerRadius={56} strokeWidth={0}>
          {data.map((d) => (
            <Cell key={d.key} fill={`var(--color-${d.key})`} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
```
This replaces the dead `Donut` component's intended purpose (an SVG donut mix visualization) with a genuine Recharts-based one — the natural place the deleted component's use case lands.

- [ ] **Step 3: Create `order-funnel-chart.tsx`**

```tsx
"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { formatInt } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  count: { label: "Orders", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Horizontal bar funnel — Placed / Confirmed / Delivered, oldest stage on
 *  top. The last stage renders in the success color so "made it all the way
 *  through" reads at a glance. Recharts' literal Funnel/trapezoid shape was
 *  considered and skipped: nothing in this codebase's build/review pipeline
 *  can render a browser, so a chart's correctness can only ever be verified
 *  by reading source and running tsc/tests — a horizontal BarChart is a
 *  pattern this exact codebase has already proven correct (RevenueChart, an
 *  identical BarChart usage, has been live since Wave 0), and reads as a
 *  valid funnel visualization on its own terms. */
export function OrderFunnelChart({ stages }: { stages: { stage: string; count: number }[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-32 w-full" role="img" aria-label="Order funnel, last 7 days">
      <BarChart data={stages} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="stage" tickLine={false} axisLine={false} width={76} stroke="var(--muted-foreground)" className="text-muted-foreground" />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatInt(Number(value))} />} />
        <Bar dataKey="count" radius={0}>
          {stages.map((s, i) => (
            <Cell key={s.stage} fill={i === stages.length - 1 ? "var(--success)" : "var(--color-count)"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
```
`layout="vertical"` in Recharts means the bars themselves run horizontally (category axis on Y, value axis on X) — this is the correct prop for a horizontal bar chart despite the name; confirm this against `recharts`' own types if in doubt, don't "fix" it to `"horizontal"` (that would flip the chart to vertical bars).

- [ ] **Step 4: Create `best-sellers-chart.tsx`**

```tsx
"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { formatLe } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Top products by revenue — the caller decides the window (7-day, or an
 *  all-time fallback when the week was quiet); this only renders whatever
 *  list it's given. */
export function BestSellersChart({ items }: { items: { name: string; minor: number }[] }) {
  const rows = items.map((it) => ({ name: it.name, revenue: it.minor }));

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full" role="img" aria-label="Best sellers by revenue">
      <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={128} stroke="var(--muted-foreground)" className="text-muted-foreground" tick={{ fontSize: 12 }} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatLe(Number(value))} />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={0} />
      </BarChart>
    </ChartContainer>
  );
}
```
A single color for every bar is deliberate — these are all the same metric (revenue) ranked against each other, not distinct categories that need distinguishing colors; a rainbow palette here would be noise, not signal. Product names longer than the 128px category-axis width will be clipped by Recharts' default tick rendering — this is a cosmetic nicety left for manual verification (Step 6) rather than a custom tick-truncation renderer, which isn't worth the added complexity for a first-cut chart.

- [ ] **Step 5: Typecheck and run the full suite**

Run: `cd web && npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass (these three files aren't consumed by anything yet — Task 2 wires them in — so this step is purely confirming they compile standalone).

- [ ] **Step 6: Manually verify**

These three components have no page rendering them yet (Task 2 does that), so there's nothing to click through in this task. Confirm only that `npx tsc --noEmit` is clean — that's the strongest signal available before Task 2 actually mounts them.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/admin/payment-mix-chart.tsx web/src/components/admin/order-funnel-chart.tsx web/src/components/admin/best-sellers-chart.tsx web/src/components/dashboard/donut.tsx
git commit -m "feat(admin): add PaymentMixChart, OrderFunnelChart, BestSellersChart; remove dead Donut component

Three new chart.tsx/Recharts-based visualizations, following
revenue-chart.tsx's established pattern (ChartConfig, ChartContainer,
token-driven colors, radius={0}). The Order Funnel uses a horizontal
BarChart rather than Recharts' literal Funnel/trapezoid shape -- see
the file's own comment for why. Also removes
components/dashboard/donut.tsx, a hand-rolled SVG donut with zero
consumers anywhere in the codebase -- exactly the bespoke
pre-chart.tsx pattern the spec asks to retire, and dead code besides.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `analytics/page.tsx` — full rewrite onto the design system

**Files:**
- Modify: `web/src/app/(dashboard)/analytics/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `PageHeader` (`@/components/admin/page-header`), `Card, CardHeader, CardTitle, CardDescription, CardContent` (`@/components/ui/card`), `DataTable, type DataTableColumn` (`@/components/admin/data-table`), `RevenueChart` (`@/components/admin/revenue-chart`, unchanged), `PaymentMixChart`/`OrderFunnelChart`/`BestSellersChart` (Task 1's new files), `ExportButton` (unchanged).
- Produces: no exported types change — this is a page component, nothing else imports from it.

- [ ] **Step 1: Rewrite the file in full**

The data-fetching and every metric computation (lines 1-108 of the current file — both Supabase queries, `live`/`last7`/`prev7` filtering, all six stat calculations, the revenue-by-day loop, the funnel array, the best-sellers `Map` aggregation, the payment-mix split) stay **completely unchanged** — only the imports and the returned JSX change. Replace the file in full:

```tsx
import { cn } from "@/lib/utils";
import { formatInt, formatLe, formatPct } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { PaymentMixChart } from "@/components/admin/payment-mix-chart";
import { OrderFunnelChart } from "@/components/admin/order-funnel-chart";
import { BestSellersChart } from "@/components/admin/best-sellers-chart";
import { ExportButton } from "@/components/admin/export-button";

export const dynamic = "force-dynamic";

const CANCELLED = new Set(["cancelled", "returned"]);
const PAST_PENDING = new Set(["confirmed", "preparing", "packing", "ready", "dispatched", "out_for_delivery", "delivered", "completed"]);
const DELIVERED = new Set(["delivered", "completed"]);

function Delta({ ratio }: { ratio: number }) {
  if (!isFinite(ratio) || ratio === 0) return <span className="nums text-xs text-muted-foreground">—</span>;
  const up = ratio > 0;
  return <span className={cn("nums text-xs font-medium", up ? "text-success" : "text-destructive")}>{up ? "▲" : "▼"} {formatPct(Math.abs(ratio), 1)}</span>;
}

type BestSellerRow = { name: string; meta: string; units: number; minor: number };

export default async function AnalyticsPage() {
  const db = createServerClient();
  const [ordersRes, itemsRes] = await Promise.all([
    db.from("order").select("total_minor, status, payment_method, placed_at, created_at"),
    db.from("order_item").select("product_name_snapshot, variant_label_snapshot, qty, line_total_minor, created_at"),
  ]);

  const orders = (ordersRes.data ?? []) as Array<{ total_minor: number; status: string; payment_method: string | null; placed_at: string | null; created_at: string }>;
  const items = (itemsRes.data ?? []) as Array<{ product_name_snapshot: string; variant_label_snapshot: string | null; qty: number; line_total_minor: number; created_at: string }>;

  const now = new Date();
  const day = 86_400_000;
  const start7 = new Date(now.getTime() - 6 * day); start7.setHours(0, 0, 0, 0);
  const startPrev = new Date(now.getTime() - 13 * day); startPrev.setHours(0, 0, 0, 0);
  const dateOf = (o: { placed_at: string | null; created_at: string }) => new Date(o.placed_at ?? o.created_at);

  const live = orders.filter((o) => !CANCELLED.has(o.status));
  const last7 = live.filter((o) => dateOf(o) >= start7);
  const prev7 = live.filter((o) => dateOf(o) >= startPrev && dateOf(o) < start7);

  const rev7 = last7.reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const revPrev = prev7.reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const orders7 = last7.length;
  const ordersPrev = prev7.length;
  const avg7 = orders7 ? Math.round(rev7 / orders7) : 0;
  const avgPrev = ordersPrev ? Math.round(revPrev / ordersPrev) : 0;
  const revRatio = revPrev ? (rev7 - revPrev) / revPrev : 0;
  const ordersRatio = ordersPrev ? (orders7 - ordersPrev) / ordersPrev : 0;
  const avgRatio = avgPrev ? (avg7 - avgPrev) / avgPrev : 0;

  const items7 = items.filter((it) => new Date(it.created_at) >= start7);
  const itemBase = items7.length ? items7 : items;
  const itemsSold = itemBase.reduce((s, it) => s + (it.qty ?? 0), 0);
  const perOrder = orders7 ? itemsSold / orders7 : 0;

  const delivered7 = last7.filter((o) => DELIVERED.has(o.status)).length;
  const deliveredRate = orders7 ? delivered7 / orders7 : 0;
  const cancelled7 = orders.filter((o) => CANCELLED.has(o.status) && dateOf(o) >= start7).length;
  const cancelRate = orders7 + cancelled7 ? cancelled7 / (orders7 + cancelled7) : 0;

  // Revenue by day.
  const revenue: number[] = [];
  const labels: string[] = [];
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short" });
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * day);
    const key = d.toDateString();
    revenue.push(last7.filter((o) => dateOf(o).toDateString() === key).reduce((s, o) => s + (o.total_minor ?? 0), 0));
    labels.push(wd.format(d));
  }

  // Order funnel.
  const confirmed = last7.filter((o) => PAST_PENDING.has(o.status)).length;
  const funnel = [
    { stage: "Placed", count: orders7 },
    { stage: "Confirmed", count: confirmed },
    { stage: "Delivered", count: delivered7 },
  ];

  // Best sellers.
  const byProduct = new Map<string, { meta: string; units: number; minor: number }>();
  for (const it of itemBase) {
    const cur = byProduct.get(it.product_name_snapshot) ?? { meta: it.variant_label_snapshot ?? "", units: 0, minor: 0 };
    cur.units += it.qty ?? 0;
    cur.minor += it.line_total_minor ?? 0;
    byProduct.set(it.product_name_snapshot, cur);
  }
  const bestTotal = [...byProduct.values()].reduce((s, v) => s + v.minor, 0) || 1;
  const best: BestSellerRow[] = [...byProduct.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.minor - a.minor).slice(0, 6);

  // Payment mix.
  const codMinor = last7.filter((o) => String(o.payment_method ?? "").includes("cash")).reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const prepaidMinor = rev7 - codMinor;
  const codShare = rev7 ? codMinor / rev7 : 0;

  const stats: Array<{ label: string; value: string; delta: React.ReactNode }> = [
    { label: "Revenue · 7d", value: formatLe(rev7), delta: <Delta ratio={revRatio} /> },
    { label: "Orders", value: formatInt(orders7), delta: <Delta ratio={ordersRatio} /> },
    { label: "Avg order", value: formatLe(avg7), delta: <Delta ratio={avgRatio} /> },
    { label: "Items sold", value: formatInt(itemsSold), delta: <span className="nums text-xs text-muted-foreground">{perOrder.toFixed(1)} / order</span> },
    { label: "Delivered", value: formatPct(deliveredRate), delta: <span className="nums text-xs text-muted-foreground">{delivered7} of {orders7}</span> },
    { label: "Cancelled", value: formatInt(cancelled7), delta: <span className="nums text-xs text-muted-foreground">{formatPct(cancelRate, 1)}</span> },
  ];

  const bestSellersColumns: DataTableColumn<BestSellerRow>[] = [
    {
      header: "Product",
      render: (b) => (
        <>
          {b.name} <span className="font-normal text-muted-foreground">{b.meta}</span>
        </>
      ),
    },
    { header: "Units", align: "right", render: (b) => <span className="nums">{formatInt(b.units)}</span> },
    { header: "Revenue", align: "right", render: (b) => <span className="nums font-medium">{formatLe(b.minor, 2)}</span> },
    { header: "Share", align: "right", render: (b) => <span className="nums text-muted-foreground">{formatPct(b.minor / bestTotal, 1)}</span> },
  ];

  return (
    <>
      <PageHeader title="Analytics" description="Live · in-house, no third-party tracking.">
        <span className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-muted-foreground">Last 7 days</span>
        <ExportButton
          filename="borteh-best-sellers.csv"
          label="Export CSV"
          headers={["Product", "Variant", "Units", "Revenue (Le)", "Share"]}
          rows={best.map((b) => [b.name, b.meta, b.units, formatLe(b.minor, 2), formatPct(b.minor / bestTotal, 1)])}
        />
      </PageHeader>

      <div className="px-5 pb-6 pt-2">
        {/* Stats */}
        <Card className="flex flex-wrap gap-y-3 p-4">
          {stats.map((s) => (
            <div key={s.label} className="mr-5 border-r border-accent pr-5 last:mr-0 last:border-0 last:pr-0">
              <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="nums text-xl font-[650] leading-tight tracking-[-0.2px]">{s.value}</span>
                {s.delta}
              </div>
            </div>
          ))}
        </Card>

        {/* Revenue + Payment mix */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card className="overflow-hidden p-0">
            <CardHeader className="border-b pt-4">
              <CardTitle role="heading" aria-level={2}>Revenue by day</CardTitle>
              <CardDescription>vs last week: {formatLe(rev7)} vs {formatLe(revPrev)}</CardDescription>
            </CardHeader>
            <CardContent className="py-4">
              <RevenueChart data={revenue} labels={labels} />
            </CardContent>
          </Card>

          <Card className="overflow-hidden p-0">
            <CardHeader className="border-b pt-4">
              <CardTitle role="heading" aria-level={2}>Payment mix</CardTitle>
            </CardHeader>
            <CardContent className="py-4">
              <PaymentMixChart codMinor={codMinor} prepaidMinor={prepaidMinor} />
              <div className="mt-3 flex flex-col gap-1 text-[13px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Cash &amp; COD</span><span className="nums font-medium">{formatLe(codMinor)} · {formatPct(codShare)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Prepaid</span><span className="nums font-medium">{formatLe(prepaidMinor)} · {formatPct(1 - codShare)}</span></div>
              </div>
              <div className="mt-4 flex flex-col gap-1 border-t border-accent pt-3 text-[13px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Delivered rate</span><span className="nums font-medium">{formatPct(deliveredRate)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cancellation rate</span><span className="nums font-medium">{formatPct(cancelRate, 1)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Avg order value</span><span className="nums font-medium">{formatLe(avg7, 2)}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Funnel + Best sellers chart */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card className="overflow-hidden p-0">
            <CardHeader className="border-b pt-4">
              <CardTitle role="heading" aria-level={2}>Order funnel</CardTitle>
            </CardHeader>
            <CardContent className="py-4">
              <OrderFunnelChart stages={funnel} />
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {funnel.slice(1).map((f, i) => {
                  const prev = funnel[i].count;
                  const drop = prev ? 1 - f.count / prev : 0;
                  return (
                    <span key={f.stage} className="nums">
                      {f.stage} <span className="text-destructive">−{formatPct(drop)}</span>
                    </span>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden p-0">
            <CardHeader className="border-b pt-4">
              <CardTitle role="heading" aria-level={2}>Best sellers · 7d</CardTitle>
            </CardHeader>
            <CardContent className="py-4">
              {best.length ? <BestSellersChart items={best} /> : <p className="text-[13px] text-muted-foreground">No sales yet.</p>}
            </CardContent>
          </Card>
        </div>

        {/* Best sellers table */}
        <div className="mt-4">
          <DataTable columns={bestSellersColumns} rows={best} rowKey={(b) => b.name} empty="No sales yet." />
        </div>
      </div>
    </>
  );
}
```

Notes on what changed and why:
- **Title changes from "Reports" to "Analytics"** — the page's own `<h1>` said "Reports" while the sidebar nav item, the route (`/analytics`), and this whole plan all say "Analytics." A small, disclosed copy fix for internal consistency, not something the spec asked for by name.
- The local `card`/`cardHead`/`cardTitle`/`rowLine` string constants are gone — every card is now a real `Card`/`CardHeader`/`CardTitle`/`CardContent`, matching the exact `overflow-hidden p-0` / `border-b pt-4` / `py-4` convention established in Product Detail and Storefront.
- **The stats strip stays a single `Card` with internal dividers**, not six separate cards — `StatCard`'s own doc comment explicitly reserves it for "the hero-metric pattern used once per page... never as a wall of co-equal tiles," so it's deliberately not used here; the strip's existing divided-row layout already avoids that anti-pattern on its own terms.
- **`funnelTop` (used only for the old hand-rolled progress-bar width calculation) and `rowLine`/`bestMax` (used only for the old hand-rolled mini-bar list) are dropped** — they have no purpose once `OrderFunnelChart`/`BestSellersChart` compute their own bar geometry internally from raw `count`/`minor` values.
- **The "Best sellers" card and the "Best sellers" table are two different things, both kept**: the card (top-6 products, chart form) replaces the old hand-rolled mini-bar list per the spec's explicit "best-sellers" chart requirement; the table (below, `DataTable`-based, Units/Revenue/Share columns) is the same `best` data in tabular form, migrated onto the shared table component rather than left as a hand-rolled `<table>`. This isn't new duplication — the original file already showed the same top-6 products twice (once as mini-bars, once as a full table); this task keeps that shape, just gives each half its proper redesigned form.
- **`BestSellerRow` is a new local type** (`{name, meta, units, minor}`) — needed to type `DataTableColumn<BestSellerRow>[]` cleanly; it's the exact shape `best` already had, just given a name for the table's column definitions.
- All three hex hits (`text-[#B5B2AC]` ×2, `bg-[#B5B2AC]` ×1) are gone because the sections they lived in (funnel drop-off text, best-sellers table meta text, payment-mix's second bar segment) are rebuilt on tokens (`text-muted-foreground`, `var(--color-prepaid)` inside the new chart component) rather than carried forward.

- [ ] **Step 2: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass.

- [ ] **Step 3: Manually verify**

Run `npm run dev`, open `/analytics`. Confirm: header renders full-bleed with "Analytics" as the title; the stats strip still shows all six numbers with correct deltas; the revenue chart renders as before (unchanged component); the payment mix donut renders with two segments and the breakdown numbers below it match; the order funnel renders as a horizontal bar chart with three bars, tallest to shortest, last bar in the success color, and the drop-off percentages below it are correct; the best-sellers chart shows up to 6 horizontal bars; the best-sellers table below it shows the same 6 products with Units/Revenue/Share columns; "Export CSV" still downloads the same best-sellers data as before.

- [ ] **Step 4: Commit**

```bash
git add "web/src/app/(dashboard)/analytics/page.tsx"
git commit -m "feat(admin): migrate Analytics onto PageHeader/Card/DataTable, real charts for payment mix/funnel/best sellers

Retires the page's own copy-pasted rounded-[12px]/shadow-[...] card
constant (this was the last file in the app carrying it) and three
raw #B5B2AC hex literals. Payment mix, order funnel, and best sellers
are now real chart.tsx/Recharts components instead of hand-rolled
div/SVG approximations; the revenue chart is unchanged (already
chart.tsx-based since Wave 0). The best-sellers table migrates onto
DataTable. Header title corrected from 'Reports' to 'Analytics' to
match the nav item and route. All metric computations and both
Supabase queries are byte-identical to before -- this is a
presentation-layer migration only.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `loading.tsx` + `error.tsx`

Deliberately last — Task 2 restructures the whole page's layout; writing a skeleton against the final shape avoids the skeleton/header-mismatch class of bug found in Wave 1's final review.

**Files:**
- Create: `web/src/app/(dashboard)/analytics/loading.tsx`
- Create: `web/src/app/(dashboard)/analytics/error.tsx`

**Interfaces:**
- Consumes: `Skeleton` (`@/components/ui/skeleton`), `PageError` (`@/components/admin/page-error`).

- [ ] **Step 1: Write the skeleton**

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-1.5 h-3 w-64" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="px-5 pb-6 pt-2">
        <Skeleton className="h-24 w-full" />
        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
        <Skeleton className="mt-4 h-48 w-full" />
      </div>
    </>
  );
}
```
(Matches the final page's shape: header, stats strip, revenue+payment-mix row, funnel+best-sellers-chart row, best-sellers table.)

- [ ] **Step 2: Write the error boundary**

```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function AnalyticsError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load analytics" reset={reset} />;
}
```

- [ ] **Step 3: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass.

- [ ] **Step 4: Manually verify**

Run `npm run dev`, throttle network (DevTools → Slow 3G) or trust the skeleton's shape by eye against the loaded page.

- [ ] **Step 5: Commit**

```bash
git add "web/src/app/(dashboard)/analytics/loading.tsx" "web/src/app/(dashboard)/analytics/error.tsx"
git commit -m "feat(admin): add loading/error states to Analytics

Authored against the Card/chart-based layout Task 2 shipped, not the
old hand-rolled layout.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

(Completed during plan-writing, not left for the executor.)

- **Spec coverage:** Problem #8 and the Decisions → Charts section are covered by Tasks 1-2 — all four named visualizations (revenue trend, payment mix, funnel, best-sellers) are now `chart.tsx`-based, three of them newly built here. The repo-wide hex/card-shell sweep's last holdout (`analytics/page.tsx`) is closed by Task 2.
- **Placeholder scan:** none found — every task gives literal target code.
- **Type consistency:** `BestSellerRow` is defined once (Task 2) and used only within that same file. `PaymentMixChart`/`OrderFunnelChart`/`BestSellersChart`'s prop types (Task 1) are referenced identically at their one call site each (Task 2) — no drift between what Task 1 produces and what Task 2 consumes.
- **Scope:** The two unbounded Supabase queries are explicitly named and left untouched, with the reasoning recorded in Global Constraints rather than silently skipped. `stat-card.tsx` is explicitly confirmed out of scope (its own doc comment rules out the "six co-equal tiles" pattern this page would otherwise tempt). `revenue-chart.tsx` is confirmed unchanged — only its wrapping `Card` shell changes, not the component itself.

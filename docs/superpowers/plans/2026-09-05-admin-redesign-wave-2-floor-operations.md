# Admin Redesign — Wave 2 (Floor Operations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Dispatch's dead rider-assignment UI (a broken `/dispatch/riders` link and hardcoded-null rider avatars implying a feature that doesn't exist), bring POS's touch targets up to the spec's 44×44pt minimum for shop-floor tablet use, migrate the Customers list onto `DataTable`/`PageHeader` with real server-side pagination (replacing an unbounded full-table scan), and apply lightweight `FormField` labeling to the Customer detail page's three micro-forms.

**Architecture:** The three areas in this wave are not equal in size or risk, and this plan treats them that way rather than forcing uniform-sized tasks. Dispatch (Task 1) and POS (Task 2) are both small: Dispatch has zero hex/shadow debt and zero forms — its only work is deleting three small dead-code sites. POS also has zero hex/shadow debt and no data-layer problem (already `.limit(500)`) — its work is a real interaction-design change (enlarging touch targets), not a token substitution. Customers (Tasks 3-4) is the largest: the list page has a genuine data-layer problem (loads the entire `app_user`/`order`/`loyalty_account` tables and aggregates client-side) that this plan fixes by following `orders.ts`'s `listOrders`/`PAGE_SIZE` pattern — **not** Products' pattern, which despite the original spec's claim never actually got real pagination wired up in Wave 1 (confirmed: `products/page.tsx` still does an unbounded `.select()` with no `DataTable` `pagination` prop). Customers' detail page needs no data-layer change (its queries are already scoped to one user) — just a header-font fix, a swallowed-error fix matching the exact anti-pattern already fixed twice in this redesign (Orders detail in Wave 1, Order detail again in Product Detail's own final review), and `FormField` wrapping on its three small forms.

Dispatch's kanban cards and POS's catalog/cart are deliberately **not** migrated onto `Card`/`DataTable` — the spec explicitly carves this out: "Individual pages may opt into a stacked-card view instead where that genuinely reads better at a glance (e.g. Dispatch's kanban, which is already card-based)." Forcing a list-page pattern onto a kanban board or a POS terminal would fight the pages' actual shape for no benefit.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), Tailwind v4, shadcn/ui, Vitest + Testing Library (`npm test`).

**Spec:** `docs/superpowers/specs/2026-09-02-admin-redesign-design.md`. Implements "Wave 2 — Floor operations. Dispatch (dead rider UI removed), POS, Customers + detail" from the Rollout waves section, plus the specific "Dispatch's rider assignment UI" bullet under Functional fixes, the "POS and Dispatch get explicit tablet/phone verification" line under Responsiveness, and the Customers-named bullets under Problem #4 and the Shared component layer section (`DataTable` bringing "Products and Customers... in line with Orders").

## Global Constraints

- Every file this plan touches lives under `web/` — no `mobile/`/`supabase/` changes, no new migrations.
- Every Server Action call (`grantPoints`, `setTier`, `issueCoupon`, `setCustomerBlocked`, `createPosSale`) is invoked with the exact same arguments as before — this plan changes visual chrome, touch-target sizing, and form UX, never business logic.
- Do not modify `page-header.tsx`, `data-table.tsx`, `empty-state.tsx`, `form-field.tsx`, `status-pill.tsx`, `chip.tsx`, `export-button.tsx`, `table-skeleton.tsx`, `page-error.tsx`, or any `*-actions.tsx`/`actions.ts` files' business logic — all pre-existing and depended on elsewhere.
- Every hardcoded hex color (`text-[#...]`, `bg-[#...]`) and hardcoded shadow/radius bracket (`shadow-[...]`, `rounded-[...]`) touched by a task's target file must become the corresponding token/utility. Acceptance check: `grep -rn "shadow-\[\|rounded-\[\|text-\[#\|bg-\[#" web/src/app/\(dashboard\)/dispatch web/src/app/\(dashboard\)/pos web/src/app/\(dashboard\)/customers web/src/components/admin/pos-terminal.tsx web/src/components/admin/customers-table.tsx web/src/components/admin/customer-loyalty.tsx web/src/components/admin/customer-coupons.tsx` must return nothing.
- Any `<TabsContent>` this plan might introduce around stateful content must pass `keepMounted` explicitly — `@base-ui/react`'s tab panels default to unmounting inactive content, which caused a real shipped data-loss bug in the Product Detail work. (In practice, no task below introduces `Tabs` — this is a standing rule for the whole redesign, not specific to this wave.)
- Run `npx tsc --noEmit` (from `web/`) after every task — must be clean before moving to the next task.
- Run `npm test` (from `web/`) after every task — full suite must pass.

---

## File Structure

Modified files:
- `web/src/app/(dashboard)/dispatch/page.tsx` — remove dead rider UI, Task 1
- `web/src/app/(dashboard)/pos/... ` — no page.tsx changes; `web/src/components/admin/pos-terminal.tsx` — touch-target fixes, Task 2
- `web/src/app/(dashboard)/customers/page.tsx` — migrate to `PageHeader`, bounded pagination, Task 3
- `web/src/components/admin/customers-table.tsx` — full rewrite onto `DataTable`, Task 3
- `web/src/app/(dashboard)/customers/[id]/page.tsx` — header font fix, error-handling fix, Task 4
- `web/src/components/admin/customer-loyalty.tsx` — `FormField` wrapping, split error state, Task 4
- `web/src/components/admin/customer-coupons.tsx` — `FormField` wrapping, Task 4

New files:
- `web/src/app/(dashboard)/dispatch/loading.tsx`, `error.tsx` — Task 1
- `web/src/app/(dashboard)/pos/loading.tsx`, `error.tsx` — Task 2
- `web/src/lib/queries/customers.ts` — Task 3
- `web/src/app/(dashboard)/customers/loading.tsx`, `error.tsx` — Task 3
- `web/src/app/(dashboard)/customers/[id]/loading.tsx`, `error.tsx` — Task 4

Explicitly NOT touched: `web/src/components/admin/customer-actions.tsx` (its native `confirm()`/`alert()` for the single Block/Unblock toggle is left as-is — a pragmatic pattern for one low-frequency destructive action, not a forms-UX violation since there's no form here; replacing it isn't requested by the spec and risks scope creep), `web/src/app/(dashboard)/pos/page.tsx` and `pos/actions.ts` (no hex/shadow debt, no data-layer problem, nothing to fix), any Server Action files' internals.

---

### Task 1: Dispatch — remove dead rider UI

**Files:**
- Modify: `web/src/app/(dashboard)/dispatch/page.tsx`
- Create: `web/src/app/(dashboard)/dispatch/loading.tsx`
- Create: `web/src/app/(dashboard)/dispatch/error.tsx`

**Interfaces:**
- Consumes: `PageHeader` (`@/components/admin/page-header`, unchanged), `StatusPill` (`@/components/admin/status-pill`, unchanged) — both already in use, no new imports needed for the page's data logic.
- Produces: no exported types change (`Job` loses one field, `rider`, which nothing outside this file consumes).

- [ ] **Step 1: Remove the dead rider code**

Three sites, all in `web/src/app/(dashboard)/dispatch/page.tsx`:

1. Remove the `Truck` icon import (used only by the Riders link being removed) — change:
```tsx
import { MapPin, Truck } from "@phosphor-icons/react/dist/ssr";
```
to:
```tsx
import { MapPin } from "@phosphor-icons/react/dist/ssr";
```

2. Remove `rider` from the `Job` type — change:
```tsx
type Job = {
  id: string;
  orderNumber: string;
  customer: string;
  zone: string;
  landmark: string;
  items: number;
  payment: { label: string; tone: PillTone };
  cod: number | null;
  rider: string | null;
};
```
to:
```tsx
type Job = {
  id: string;
  orderNumber: string;
  customer: string;
  zone: string;
  landmark: string;
  items: number;
  payment: { label: string; tone: PillTone };
  cod: number | null;
};
```

3. Remove the `rider: null,` line from the card-construction object (it's always `null` today — `delivery_job.rider_id` is fetched but never looked up against a `rider` name table, unlike the `app_user`/`delivery_zone` lookups right next to it):
```tsx
    const card: Job = {
      id: o.id as string,
      orderNumber: o.order_number as string,
      customer: (nameById.get(o.user_id) as string) ?? (o.recipient_name_snapshot as string) ?? "Customer",
      zone: (zoneById.get(o.delivery_zone_id) as string) ?? "—",
      landmark: (o.landmark_snapshot as string) ?? "",
      items: itemCount.get(o.id as string) ?? 0,
      payment: isCod ? { label: "COD", tone: "warning" } : { label: "Prepaid", tone: "info" },
      cod: isCod ? (o.total_minor as number) : null,
      rider: null,
    };
```
→ delete the `rider: null,` line.

4. Replace the header — remove the broken Riders link entirely and correct the description (it currently claims "Assign riders" as something this page does, which is exactly the "decorative UI implying features that don't exist" problem the spec names). Change:
```tsx
      <PageHeader title="Dispatch" description="Assign riders and track deliveries across the day.">
        <Link
          href="/dispatch/riders"
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Truck weight="duotone" className="size-4" />
          Riders
        </Link>
      </PageHeader>
```
to:
```tsx
      <PageHeader title="Dispatch" description="Track deliveries across the day." />
```

5. Remove the unreachable rider-avatar render branch (dead code — `job.rider` no longer exists on the type, and never rendered a truthy value even before this task):
```tsx
                    {job.rider ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span className="grid size-5 place-items-center rounded-full bg-muted text-[0.6rem] font-semibold text-muted-foreground">
                          {job.rider[0]}
                        </span>
                        {job.rider}
                      </span>
                    ) : null}
```
→ delete this block entirely (it sits right after the `{job.cod ? (...) : (...)}` block inside the `<div className="mt-3 flex items-center justify-between border-t border-border pt-3">` row — removing it leaves that row with just the cod/items span, which is fine since `justify-between` degrades gracefully with one child).

No `EmptyState`-style banner is added in place of the removed rider UI: the spec's "Replace with an honest EmptyState ('Rider assignment isn't set up yet')" phrasing was written with a list page's empty-state slot in mind, but Dispatch is a kanban with real, non-empty data — a permanent full-width banner on every visit would be more noise than the fix requires. Correcting the header description (step 4) already resolves the "implying a feature that doesn't exist" problem honestly, without adding a redundant permanent notice. If a reviewer disagrees and wants an explicit note somewhere on the page, that's a one-line addition — flag it rather than silently adding it.

`Link` itself is still used elsewhere in this file (each job card is a `<Link href={\`/orders/${job.id}\`}>`) — do not remove the `Link` import, only `Truck`.

- [ ] **Step 2: Add loading and error states**

Create `web/src/app/(dashboard)/dispatch/loading.tsx`:
```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function DispatchLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-20" />
          <Skeleton className="mt-1.5 h-3 w-56" />
        </div>
      </div>
      <div className="grid gap-5 px-6 py-6 lg:grid-cols-3 lg:px-10">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </>
  );
}
```
(The header block's classes match `PageHeader`'s own full-bleed box exactly, so the skeleton's header doesn't jump on hydration — the same class of bug Wave 1's final review found and fixed on three list pages.)

Create `web/src/app/(dashboard)/dispatch/error.tsx`:
```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function DispatchError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load dispatch" reset={reset} />;
}
```

- [ ] **Step 3: Typecheck and run the full suite**

Run: `cd web && npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass.

- [ ] **Step 4: Manually verify**

Run `npm run dev`, sign in, open `/dispatch`. Confirm: no "Riders" button in the header, header description no longer mentions assigning riders, kanban cards render exactly as before (customer, zone/landmark, COD/item count) with no leftover rider row, clicking a card still navigates to its order.

- [ ] **Step 5: Commit**

```bash
git add "web/src/app/(dashboard)/dispatch/page.tsx" "web/src/app/(dashboard)/dispatch/loading.tsx" "web/src/app/(dashboard)/dispatch/error.tsx"
git commit -m "fix(admin): remove Dispatch's dead rider-assignment UI, add loading/error states

The /dispatch/riders link 404s (no such route exists) and every card's
rider avatar was hardcoded to null (delivery_job.rider_id is fetched but
never looked up against a name), so the rider UI could never render
anything but implied a feature that doesn't exist. Removes the broken
link, the dead field, and the unreachable render branch; corrects the
header description to not claim rider assignment happens here.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: POS — touch-target fixes for shop-floor tablet use

**Files:**
- Modify: `web/src/components/admin/pos-terminal.tsx`
- Create: `web/src/app/(dashboard)/pos/loading.tsx`
- Create: `web/src/app/(dashboard)/pos/error.tsx`

**Interfaces:**
- Consumes: nothing new — no new imports needed, this task only changes existing className strings.
- Produces: `PosTerminal`'s exported types (`CatalogItem`, `PosCombo`) and prop signature are unchanged.

This task is a real interaction-design change, not a token substitution: the spec requires "minimum 44×44pt on every interactive element," and today's cart-row buttons are 24px. Every change below is a `className` edit only — no state, handler, or Server Action call changes.

- [ ] **Step 1: Enlarge the cart quantity-stepper buttons**

In `web/src/components/admin/pos-terminal.tsx`, the decrement button:
```tsx
                <button type="button" onClick={() => setQty(l.item.id, l.qty - 1)} className="grid size-6 place-items-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted">
                  <Minus className="size-3" />
                </button>
```
→ change `size-6` to `size-11` (24px → 44px):
```tsx
                <button type="button" onClick={() => setQty(l.item.id, l.qty - 1)} className="grid size-11 place-items-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted">
                  <Minus className="size-3" />
                </button>
```
And the matching increment button:
```tsx
                <button type="button" onClick={() => setQty(l.item.id, Math.min(l.qty + 1, l.item.stock))} className="grid size-6 place-items-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted">
                  <Plus className="size-3" />
                </button>
```
→ same change, `size-6` to `size-11`.

This visibly enlarges the bordered button box, not just its invisible hit area — on a touch device, a bigger, more visible button is the correct outcome here, not a compromise.

- [ ] **Step 2: Give the Remove (trash) button a real hit area without changing its visual size**

This button currently has no size class at all — its tappable area is just the icon's rendered footprint. Unlike the stepper buttons, it has no visible border/background, so it can get a larger invisible hit area without looking any different:
```tsx
              <button type="button" aria-label="Remove" onClick={() => setQty(l.item.id, 0)} className="text-muted-foreground transition-colors hover:text-destructive">
                <Trash className="size-4" />
              </button>
```
→
```tsx
              <button type="button" aria-label="Remove" onClick={() => setQty(l.item.id, 0)} className="grid size-11 shrink-0 place-items-center text-muted-foreground transition-colors hover:text-destructive">
                <Trash className="size-4" />
              </button>
```

- [ ] **Step 3: Bring the tender toggle buttons up to 44px height**

```tsx
              className={cn(
                "inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition-colors",
                tender === t ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"
              )}
```
→ change `h-10` to `h-11` (40px → 44px):
```tsx
              className={cn(
                "inline-flex h-11 items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition-colors",
                tender === t ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"
              )}
```

- [ ] **Step 4: Ensure the combo-tap buttons meet the height minimum**

Their current `px-3 py-2` padding plus text content likely renders under 44px tall. Add an explicit floor:
```tsx
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-left transition-colors hover:border-foreground/20 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
```
→
```tsx
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-left transition-colors hover:border-foreground/20 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
```

Product catalog tiles (the `p-3` buttons with stacked image/name/price/stock content) and the "Charge" button (already `h-11`) are not touched — both already comfortably exceed 44px given their content, confirmed by inspection, not assumed.

- [ ] **Step 5: Add loading and error states**

Create `web/src/app/(dashboard)/pos/loading.tsx`:
```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function PosLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-1.5 h-3 w-64" />
        </div>
      </div>
      <div className="grid gap-0 lg:grid-cols-[1fr_22rem]">
        <div className="border-b border-border px-6 py-5 lg:border-r lg:border-b-0 lg:px-10">
          <Skeleton className="mb-5 h-10 w-full max-w-md" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="px-6 py-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-40 w-full" />
        </div>
      </div>
    </>
  );
}
```

Create `web/src/app/(dashboard)/pos/error.tsx`:
```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function PosError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load the till" reset={reset} />;
}
```

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass.

- [ ] **Step 7: Manually verify on a real tablet-width viewport**

Run `npm run dev`, open `/pos` at a tablet viewport (DevTools device toolbar, or a real iPad if available — the spec explicitly asks for real tablet/phone verification here, not just a responsive-grid pass). Confirm: adding a product to the cart, adjusting its quantity with the +/- buttons, removing a line, and charging a sale all still work exactly as before; the enlarged buttons don't cause the cart row to wrap awkwardly or overflow the `22rem` aside at common tablet widths (check ~768px and ~1024px).

- [ ] **Step 8: Commit**

```bash
git add web/src/components/admin/pos-terminal.tsx "web/src/app/(dashboard)/pos/loading.tsx" "web/src/app/(dashboard)/pos/error.tsx"
git commit -m "fix(admin): enlarge POS touch targets to meet the 44x44pt minimum

Cart quantity-stepper buttons were 24px, the Remove button had no
explicit hit area, the tender toggle was 40px tall, and combo-tap
buttons could render under 44px depending on content — all below the
spec's shop-floor touch-target requirement. Stepper/tender buttons are
visibly enlarged (a bigger, more visible button is the right outcome on
a touch device); Remove gets a larger invisible hit area since it has
no visible chrome to preserve. No behavior changes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Customers list — bounded pagination, `DataTable`/`PageHeader` migration

**Files:**
- Create: `web/src/lib/queries/customers.ts`
- Modify: `web/src/app/(dashboard)/customers/page.tsx`
- Modify: `web/src/components/admin/customers-table.tsx` (full rewrite)
- Create: `web/src/app/(dashboard)/customers/loading.tsx`
- Create: `web/src/app/(dashboard)/customers/error.tsx`

**Interfaces:**
- Consumes: `DataTable`, `DataTableColumn<T>`, `DataTablePagination`, `DataTableSummaryStat` (`@/components/admin/data-table`, Wave 0, unchanged), `PageHeader` (`@/components/admin/page-header`, unchanged), `EmptyState` (`@/components/admin/empty-state`, unchanged), `ExportButton` (`@/components/admin/export-button`, unchanged, has a pre-existing `label?: string` prop).
- Produces: `listCustomers(db, {page, pageSize?})` → `{rows: CustomerRecord[], total: number}` and `getBlockedCustomerCount(db)` → `number`, both in the new `web/src/lib/queries/customers.ts` — mirroring `web/src/lib/queries/orders.ts`'s `listOrders`/`PAGE_SIZE` pattern exactly (bounded, throws on error). `CustomersTable({customers, summary, page, total, pageSize})` — same `CustomerRow` shape as before, new props for pagination.

- [ ] **Step 1: Write the bounded query helper**

Create `web/src/lib/queries/customers.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export const PAGE_SIZE = 50;

export type CustomerRecord = {
  id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  is_blocked: boolean | null;
  created_at: string | null;
};

/** One page of customers, newest first. Always bounded. */
export async function listCustomers(
  db: SupabaseClient,
  { page, pageSize = PAGE_SIZE }: { page: number; pageSize?: number },
): Promise<{ rows: CustomerRecord[]; total: number }> {
  const from = page * pageSize;
  const { data, count, error } = await db
    .from("app_user")
    .select("id, display_name, phone, email, role, is_blocked, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { rows: (data ?? []) as CustomerRecord[], total: count ?? 0 };
}

/** Total customers currently blocked — a cheap indexed count, not a row scan. */
export async function getBlockedCustomerCount(db: SupabaseClient): Promise<number> {
  const { count, error } = await db.from("app_user").select("id", { count: "exact", head: true }).eq("is_blocked", true);
  if (error) throw error;
  return count ?? 0;
}
```

- [ ] **Step 2: Rewrite `customers-table.tsx` onto `DataTable`**

Replace the file in full:
```tsx
"use client";

import { useRouter } from "next/navigation";

import { formatInt, formatLe } from "@/lib/format";
import { Chip, type Tone } from "@/components/admin/chip";
import { DataTable, type DataTableColumn, type DataTablePagination, type DataTableSummaryStat } from "@/components/admin/data-table";

export type CustomerRow = {
  id: string;
  name: string;
  contact: string;
  tierLabel: string;
  tierTone: Tone;
  orders: number;
  spent: number;
  last: string;
};

export function CustomersTable({
  customers,
  summary,
  page,
  total,
  pageSize,
}: {
  customers: CustomerRow[];
  summary: DataTableSummaryStat[];
  page: number;
  total: number;
  pageSize: number;
}) {
  const router = useRouter();

  const columns: DataTableColumn<CustomerRow>[] = [
    {
      header: "Customer",
      render: (c) => (
        <>
          {c.name} <span className="nums font-normal text-xs text-muted-foreground">{c.contact}</span>
        </>
      ),
    },
    { header: "Tier", render: (c) => <Chip tone={c.tierTone}>{c.tierLabel}</Chip> },
    { header: "Orders", align: "right", render: (c) => <span className="nums">{formatInt(c.orders)}</span> },
    { header: "Total spent", align: "right", render: (c) => <span className="nums font-medium">{formatLe(c.spent, 2)}</span> },
    { header: "Last order", align: "right", render: (c) => <span className="text-muted-foreground">{c.last}</span> },
  ];

  const pagination: DataTablePagination | undefined =
    total > customers.length ? { page, pageSize, total, hrefFor: (p) => `/customers?page=${p}` } : undefined;

  return (
    <DataTable
      summary={summary}
      columns={columns}
      rows={customers}
      rowKey={(c) => c.id}
      onRowClick={(c) => router.push(`/customers/${c.id}`)}
      empty="No customers match this view."
      pagination={pagination}
    />
  );
}
```
Notes on what changed from the original: the outer `rounded-[12px] border ... shadow-[...]` shell and hand-rolled `<table>` are gone (replaced by `DataTable`); `text-[#B5B2AC]` on the contact sub-text is now `text-muted-foreground` (matching the exact same substitution Wave 1 made on Products/Inventory); `text-[12px]` is normalized to the `text-xs` token (a free cleanup alongside the required hex fix, not a separate requirement); row-click-to-navigate now goes through `DataTable`'s `onRowClick` prop instead of a hand-rolled `onClick` on each `<tr>` — same behavior, now using the shared mechanism Orders/Products/Inventory all use; `pagination`/`summary` are new props this component didn't have before, mirroring `OrdersTable`'s exact pattern (`pagination={total > orders.length ? {...} : undefined}` — copied verbatim from `web/src/components/admin/orders-table.tsx`).

- [ ] **Step 3: Rewrite `customers/page.tsx` with bounded, paginated queries**

Replace the file in full:
```tsx
import { createServerClient } from "@/lib/supabase/server";
import { type Tone } from "@/components/admin/chip";
import { CustomersTable, type CustomerRow } from "@/components/admin/customers-table";
import { PageHeader } from "@/components/admin/page-header";
import { ExportButton } from "@/components/admin/export-button";
import { EmptyState } from "@/components/admin/empty-state";
import { formatInt, formatLe } from "@/lib/format";
import { listCustomers, getBlockedCustomerCount, PAGE_SIZE } from "@/lib/queries/customers";
import { type DataTableSummaryStat } from "@/components/admin/data-table";

export const dynamic = "force-dynamic";

type Customer = {
  id: string;
  name: string;
  contact: string;
  orders: number;
  spent: number;
  blocked: boolean;
  points: number;
  last: string;
};

function loyaltyTier(points: number, blocked: boolean): { label: string; tone: Tone } {
  if (blocked) return { label: "Blocked", tone: "danger" };
  if (points >= 500) return { label: "Gold", tone: "warning" };
  if (points >= 100) return { label: "Silver", tone: "neutral" };
  return { label: "Member", tone: "info" };
}

function lastOrderLabel(iso: string | null): string {
  if (!iso) return "No orders";
  const then = new Date(iso);
  const now = new Date();
  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate();
  if (sameDay) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const wasYesterday =
    then.getFullYear() === yesterday.getFullYear() &&
    then.getMonth() === yesterday.getMonth() &&
    then.getDate() === yesterday.getDate();
  if (wasYesterday) return "Yesterday";
  return then.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const db = createServerClient();
  const page = Math.max(0, Number((await searchParams).page ?? "0") || 0);

  const [{ rows: users, total }, blockedTotal] = await Promise.all([
    listCustomers(db, { page, pageSize: PAGE_SIZE }),
    getBlockedCustomerCount(db),
  ]);

  // Order/loyalty stats are scoped to just this page's users — bounded, not a
  // full-table scan the way the pre-migration version worked.
  const userIds = users.map((u) => u.id);
  const [ordersRes, loyaltyRes] = await Promise.all([
    userIds.length
      ? db.from("order").select("user_id, total_minor, status, created_at").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; total_minor: number | null; status: string | null; created_at: string | null }[] }),
    userIds.length
      ? db.from("loyalty_account").select("user_id, points_balance").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; points_balance: number | null }[] }),
  ]);

  const stats = new Map<string, { orders: number; spent: number; last: string | null }>();
  for (const o of (ordersRes.data ?? []) as { user_id: string; total_minor: number | null; status: string | null; created_at: string | null }[]) {
    if (!o.user_id) continue;
    const cur = stats.get(o.user_id) ?? { orders: 0, spent: 0, last: null };
    cur.orders += 1;
    if (o.status !== "cancelled") cur.spent += Number(o.total_minor ?? 0);
    if (o.created_at && (!cur.last || o.created_at > cur.last)) cur.last = o.created_at;
    stats.set(o.user_id, cur);
  }

  const points = new Map<string, number>();
  for (const l of (loyaltyRes.data ?? []) as { user_id: string; points_balance: number | null }[]) {
    if (l.user_id) points.set(l.user_id, Number(l.points_balance ?? 0));
  }

  const customers: Customer[] = users.map((u) => {
    const s = stats.get(u.id);
    return {
      id: u.id,
      name: u.display_name?.trim() || "Unnamed customer",
      contact: u.phone || u.email || "—",
      orders: s?.orders ?? 0,
      spent: s?.spent ?? 0,
      blocked: u.is_blocked ?? false,
      points: points.get(u.id) ?? 0,
      last: lastOrderLabel(s?.last ?? null),
    };
  });

  const rows: CustomerRow[] = customers.map((c) => {
    const tier = loyaltyTier(c.points, c.blocked);
    return {
      id: c.id,
      name: c.name,
      contact: c.contact,
      tierLabel: tier.label,
      tierTone: tier.tone,
      orders: c.orders,
      spent: c.spent,
      last: c.last,
    };
  });

  const summary: DataTableSummaryStat[] = [
    { n: formatInt(total), label: "customers", tone: "text-foreground" },
    { n: formatInt(blockedTotal), label: "blocked", tone: blockedTotal ? "text-destructive" : "text-foreground" },
  ];

  return (
    <>
      <PageHeader title="Customers" description={`${formatInt(total)} ${total === 1 ? "customer" : "customers"}.`}>
        <ExportButton
          label="Export this page"
          filename="borteh-customers.csv"
          headers={["Name", "Contact", "Tier", "Orders", "Total spent (Le)", "Last order"]}
          rows={rows.map((c) => [c.name, c.contact, c.tierLabel, c.orders, formatLe(c.spent, 2), c.last])}
        />
      </PageHeader>

      <div className="px-5 pb-6 pt-2">
        {total === 0 ? (
          <EmptyState title="No customers yet" description="Customers will appear here once people sign up and start ordering." />
        ) : (
          <CustomersTable customers={rows} summary={summary} page={page} total={total} pageSize={PAGE_SIZE} />
        )}
      </div>
    </>
  );
}
```
Notes on what changed and why:
- The old version's swallowed-error string ("Couldn't load customers — check the Supabase keys in web/.env.local.") is gone — `listCustomers`/`getBlockedCustomerCount` both `throw` on a real Supabase error, which the new `error.tsx` (Step 4) now actually catches, matching the exact pattern Wave 1 fixed on Products/Inventory and Product Detail's final review fixed on Order detail.
- `ExportButton` gets `label="Export this page"` — an honest label matching Orders' own convention (`orders/page.tsx:77`) for the exact same "this now exports one page, not the whole table" change that pagination introduces.
- The old hand-rolled `rounded-[12px] ... shadow-[...]` empty-state block is now the shared `EmptyState` component.
- Header moves from a hand-rolled `<div className="px-5 pb-6 pt-2">` wrapper to `PageHeader`, rendered full-bleed as a sibling before the padded content `<div>` (the exact pattern every other migrated list page uses — never nest `PageHeader` inside the padded wrapper).

- [ ] **Step 4: Add loading and error states**

Create `web/src/app/(dashboard)/customers/loading.tsx`:
```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/admin/table-skeleton";

export default function CustomersLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-28" />
          <Skeleton className="mt-1.5 h-3 w-40" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="px-5 pb-6 pt-2">
        <TableSkeleton columns={5} rows={10} />
      </div>
    </>
  );
}
```

Create `web/src/app/(dashboard)/customers/error.tsx`:
```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function CustomersError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load customers" reset={reset} />;
}
```

- [ ] **Step 5: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass.

- [ ] **Step 6: Manually verify**

Run `npm run dev`, open `/customers`. Confirm: header matches other migrated list pages' full-bleed alignment and typography, table renders with square corners, the "customers"/"blocked" summary strip shows sensible numbers, clicking a row navigates to that customer's detail page, "Export this page" downloads only the current page's rows. If there are more than 50 customers seeded, confirm pagination controls appear and page 2 shows different rows with correctly bounded per-page stats.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/queries/customers.ts web/src/components/admin/customers-table.tsx "web/src/app/(dashboard)/customers/page.tsx" "web/src/app/(dashboard)/customers/loading.tsx" "web/src/app/(dashboard)/customers/error.tsx"
git commit -m "feat(admin): migrate Customers to PageHeader + DataTable, bound and paginate queries

The list page loaded the entire app_user, order, and loyalty_account
tables and aggregated client-side — now follows orders.ts's
listOrders/PAGE_SIZE pattern (bounded, paginated, throws on failure)
rather than Products' pattern, which despite the original spec's claim
never actually got real pagination wired up. CustomersTable now composes
DataTable instead of hand-rolling its own Card+table shell, killing the
literal '#B5B2AC' hex the spec's own problem statement names as an
example. Customers page now throws on a Supabase query failure instead
of showing a developer-facing 'check the Supabase keys' string.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Customer detail — header font, error handling, `FormField` on the three micro-forms

**Files:**
- Modify: `web/src/app/(dashboard)/customers/[id]/page.tsx`
- Modify: `web/src/components/admin/customer-loyalty.tsx`
- Modify: `web/src/components/admin/customer-coupons.tsx`
- Create: `web/src/app/(dashboard)/customers/[id]/loading.tsx`
- Create: `web/src/app/(dashboard)/customers/[id]/error.tsx`

**Interfaces:**
- Consumes: `FormField` (`@/components/admin/form-field`, `{label, htmlFor, optional?, helper?, error?, children}`, single-element `children`, does not inject `id` — the child must carry a matching `id={htmlFor}` itself).
- Produces: `CustomerLoyalty`/`CustomerCoupons` keep their exact existing prop signatures — no changes to what `customers/[id]/page.tsx` passes them.

- [ ] **Step 1: Fix the header font and the swallowed query error**

In `web/src/app/(dashboard)/customers/[id]/page.tsx`, the header currently uses `font-semibold tracking-tight` without the redesign's serif token — every other migrated header (`PageHeader`, Product Detail, New Product) uses `font-display` alongside that weight/tracking. Change:
```tsx
                <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
```
to:
```tsx
                <h1 className="font-display text-xl font-semibold tracking-tight">{name}</h1>
```

The primary customer query drops `error` entirely (only destructures `data`), so a real Supabase failure falls through to `if (!customer) notFound()` — showing "page not found" instead of triggering an error boundary, the same anti-pattern already fixed twice elsewhere in this redesign. Change:
```tsx
  const { data: customer } = await db
    .from("app_user")
    .select("id, display_name, phone, email, role, is_blocked, created_at, referral_code, referred_by")
    .eq("id", id)
    .maybeSingle();
  if (!customer) notFound();
```
to:
```tsx
  const { data: customer, error } = await db
    .from("app_user")
    .select("id, display_name, phone, email, role, is_blocked, created_at, referral_code, referred_by")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!customer) notFound();
```
Every other query on this page (`ordersRes`, `acctRes`, `tiersRes`, `couponsRes`, `ledgerRes`, `referredRes`, `referrerRes`, the follow-up `rewardRows` query) stays exactly as-is — they already have reasonable `?? []`/`?? null` fallbacks for auxiliary data, matching the same scope boundary Product Detail's final-review fix drew around `orders/[id]/page.tsx` (only the primary entity query gets a hard throw).

- [ ] **Step 2: Wrap `CustomerLoyalty`'s two forms in `FormField`, split its error state**

The "Loyalty card" select has a visible label today (via a native `<label>`) but no `FormField`/`id` wiring; the "Grant points" amount and reason inputs have no visible label at all (placeholder-only, violating "Labels are always visible... never placeholder-only"); and one shared `err` state currently shows under the whole card regardless of which action (grant vs. tier-change) actually failed, so an error can render in a place unrelated to what caused it.

Replace the file in full:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sparkle } from "@phosphor-icons/react";

import { grantPoints, setTier } from "@/app/(dashboard)/customers/actions";
import { formatInt } from "@/lib/format";
import { FormField } from "@/components/admin/form-field";

type Tier = { id: string; name: string; discount: number };

export function CustomerLoyalty({
  userId,
  points,
  currentTierId,
  tiers,
}: {
  userId: string;
  points: number;
  currentTierId: string | null;
  tiers: Tier[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [grantErr, setGrantErr] = useState<string | null>(null);
  const [tierErr, setTierErr] = useState<string | null>(null);

  function grant() {
    const n = parseInt(amount, 10);
    setGrantErr(null);
    start(async () => {
      const res = await grantPoints(userId, n, reason);
      if (res.ok) { setAmount(""); setReason(""); router.refresh(); }
      else setGrantErr(res.error);
    });
  }

  function changeTier(tierId: string) {
    setTierErr(null);
    start(async () => {
      const res = await setTier(userId, tierId || null);
      if (res.ok) router.refresh();
      else setTierErr(res.error);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Loyalty</h2>

      <div className="mt-3 flex items-baseline gap-2">
        <Sparkle weight="duotone" className="size-5 text-primary" />
        <span className="nums text-2xl font-semibold tracking-tight">{formatInt(points)}</span>
        <span className="text-sm text-muted-foreground">points</span>
      </div>

      <div className="mt-4">
        <FormField label="Loyalty card" htmlFor="loyalty-tier" error={tierErr ?? undefined}>
          <select
            id="loyalty-tier"
            value={currentTierId ?? ""}
            onChange={(e) => changeTier(e.target.value)}
            disabled={pending}
            className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <option value="">No card</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>{t.name} · {t.discount}% off</option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-sm font-medium">Grant points</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <FormField label="Points" htmlFor="grant-amount" error={grantErr ?? undefined}>
            <input
              id="grant-amount"
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setGrantErr(null); }}
              className="nums h-9 w-24 rounded-md border border-border bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            />
          </FormField>
          <FormField label="Reason" htmlFor="grant-reason" optional>
            <input
              id="grant-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            />
          </FormField>
          <button
            type="button"
            onClick={grant}
            disabled={pending || !amount}
            className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            Apply
          </button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">Use a negative number to deduct.</p>
      </div>
    </div>
  );
}
```
Notes: `err` is split into `grantErr`/`tierErr` so each `FormField`'s `error` prop shows only the message relevant to that specific action, per the spec's "render directly under the field they belong to" requirement — a real fix, not just a rename, since the old single `err` could show a tier-change failure under a card that visually reads as being about the grant-points row. `FormField`'s `optional` prop marks Reason (never marked required in the original), matching the "mark optional fields optional" convention. The outer card shell (`rounded-xl border border-border bg-card p-5`) is untouched — no hex/shadow issue exists here, so this task only changes form semantics, not visual chrome.

- [ ] **Step 3: Wrap `CustomerCoupons`' percent input in `FormField`**

The percent input has no `<label>`/`id` at all today — just an inline "% off" suffix. Replace the file in full:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ticket } from "@phosphor-icons/react";

import { issueCoupon } from "@/app/(dashboard)/customers/actions";
import { FormField } from "@/components/admin/form-field";

type Coupon = { code: string; discount: number; active: boolean };

export function CustomerCoupons({
  userId,
  customerName,
  coupons,
}: {
  userId: string;
  customerName: string;
  coupons: Coupon[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [percent, setPercent] = useState("10");
  const [err, setErr] = useState<string | null>(null);
  const [issued, setIssued] = useState<string | null>(null);

  function issue() {
    const n = parseInt(percent, 10);
    setErr(null);
    setIssued(null);
    start(async () => {
      const res = await issueCoupon(userId, customerName, n);
      if (res.ok) { setIssued(res.code); router.refresh(); }
      else setErr(res.error);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Coupons</h2>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <FormField label="Discount" htmlFor="coupon-percent" error={err ?? undefined}>
          <input
            id="coupon-percent"
            type="number"
            min={1}
            max={100}
            value={percent}
            onChange={(e) => { setPercent(e.target.value); setErr(null); }}
            className="nums h-9 w-16 rounded-md border border-border bg-background px-2.5 text-right text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          />
        </FormField>
        <span className="pb-2.5 text-sm text-muted-foreground">% off</span>
        <button
          type="button"
          onClick={issue}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          <Ticket weight="duotone" className="size-4" />
          Issue coupon
        </button>
      </div>

      {issued ? (
        <p className="mt-2 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-sm text-success-soft-foreground">
          Coupon created — give them code <span className="nums font-semibold">{issued}</span>
        </p>
      ) : null}

      <ul className="mt-4 divide-y divide-border border-t border-border">
        {coupons.map((c) => (
          <li key={c.code} className="flex items-center justify-between py-2.5 text-sm">
            <span className="nums font-medium">{c.code}</span>
            <span className="flex items-center gap-3 text-muted-foreground">
              <span>{c.discount}% off</span>
              <span className={c.active ? "text-success-soft-foreground" : "text-muted-foreground"}>
                {c.active ? "Active" : "Used / off"}
              </span>
            </span>
          </li>
        ))}
        {coupons.length === 0 ? <li className="py-3 text-sm text-muted-foreground">No coupons issued yet.</li> : null}
      </ul>
    </div>
  );
}
```
Note the `% off` suffix and the "Issue coupon" button moved outside `FormField` (as siblings in the same flex row, `items-end` aligning them with the input's bottom edge) rather than nested inside it: `FormField` clones `aria-describedby` onto its single child directly, so the actual `<input>` must be that child — wrapping the input together with the suffix text in one `<div>` would put `aria-describedby` on the wrapper instead of the input itself, the exact accessibility bug Product Detail's final review found and fixed on the Variants Price field's error wiring. The old shared `err`-and-`issued` banner below the row is preserved as-is (the "coupon created, here's the code" success message isn't a validation error, so it doesn't belong inside `FormField`'s error slot).

- [ ] **Step 4: Add loading and error states**

Create `web/src/app/(dashboard)/customers/[id]/loading.tsx`:
```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerDetailLoading() {
  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Skeleton className="h-3.5 w-20" />
        <div className="mt-3 flex items-center gap-3">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-1.5 h-3 w-56" />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-10 gap-y-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
      <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.5fr_1fr] lg:px-10">
        <Skeleton className="h-96 w-full" />
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </>
  );
}
```

Create `web/src/app/(dashboard)/customers/[id]/error.tsx`:
```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function CustomerDetailError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load this customer" reset={reset} />;
}
```

- [ ] **Step 5: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass.

- [ ] **Step 6: Manually verify**

Run `npm run dev`, open any customer's detail page. Confirm: the name heading now renders in the serif font matching other detail pages; the Loyalty card select and Grant-points fields now show visible labels above them; the Coupons discount field shows a visible "Discount" label; granting points, changing tier, and issuing a coupon all still work exactly as before, and a failed grant/tier-change now shows its error under the correct specific field rather than a shared banner.

- [ ] **Step 7: Commit**

```bash
git add "web/src/app/(dashboard)/customers/[id]/page.tsx" web/src/components/admin/customer-loyalty.tsx web/src/components/admin/customer-coupons.tsx "web/src/app/(dashboard)/customers/[id]/loading.tsx" "web/src/app/(dashboard)/customers/[id]/error.tsx"
git commit -m "fix(admin): Customer detail header font, swallowed query error, FormField on its 3 micro-forms

Header now uses font-display matching every other migrated detail page.
The primary customer query now throws on failure instead of showing a
false 'not found' for a real error — the same anti-pattern already fixed
twice elsewhere in this redesign. CustomerLoyalty's Loyalty-card select
and Grant-points fields, and CustomerCoupons' discount field, now have
visible FormField labels instead of placeholder-only inputs; grant vs.
tier-change errors are split into separate state so each shows under its
own field instead of a shared banner.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

(Completed during plan-writing, not left for the executor.)

- **Spec coverage:** "Dispatch's rider assignment UI... remove the dead `/dispatch/riders` link and the `rider: null` hardcoded avatar UI" (Task 1). "POS and Dispatch get explicit tablet/phone verification" — Dispatch has no forms/state to verify beyond the kanban's existing links (covered by Task 1's manual-verify step); POS's actual interaction change is Task 2. Customers named in Problem #4 (unbounded client-side aggregation) and the Shared component layer section (`DataTable` bringing Customers in line with Orders) — both addressed by Task 3, following the *correct* precedent (`orders.ts`, not the incompletely-migrated Products) per this plan's own research. Forms UX conventions (visible labels, field-level errors) applied to Customer detail's three micro-forms in Task 4, scoped lightly per the spec's own implicit scale distinction (this isn't the 307-line Product editor).
- **Placeholder scan:** none found — every task's target code is literal, not described abstractly.
- **Type consistency:** `CustomerRow`, `DataTableSummaryStat`, `DataTablePagination` are defined once and referenced identically across Task 3's two files. `CustomerRecord` (new, in `lib/queries/customers.ts`) is used only inside `listCustomers` and `customers/page.tsx`'s mapping — no other file needs to know its shape. `CustomerLoyalty`/`CustomerCoupons`' prop signatures are unchanged from before Task 4, confirmed against `customers/[id]/page.tsx`'s existing call sites (untouched by this task).
- **Scope:** `customer-actions.tsx`'s `confirm()`/`alert()` pattern is explicitly left alone (documented in File Structure) — not a forms-UX violation, not requested by the spec, and changing it risks scope creep into a UI pattern this redesign hasn't established a replacement for anywhere else. POS's cart/claim/discount math and `pos/actions.ts`'s Server Action are explicitly unchanged — confirmed no task touches either. Dispatch and Customers detail's secondary/auxiliary queries (zone/user lookups, loyalty ledger, referral data) are explicitly left with their existing soft fallbacks, matching the exact scope boundary Product Detail's final review drew for `orders/[id]/page.tsx`.

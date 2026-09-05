# Admin Redesign — Wave 3a (Collections, Combos, Brands) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Collections, Combos, and Brands' list pages onto `DataTable`, rework their "new"/edit forms onto `FormSection`/`FormField` with real inline validation (replacing generic server-error banners), fix a swallowed-error string repeated across all three list pages, and remove a decorative "drag to reorder" affordance that has no backing implementation on two of the three tables.

**Architecture:** These three areas are near-identical in shape — a `DataTable`-eligible list page and a single shared form component reused for both "new" and "edit" routes — so this plan treats Collections and Brands as one batched task (their forms are structurally identical: Name, Slug, optional Description, two visibility toggles) and gives Combos its own task, since its form has a real repeating-picker UI (fragrances in the pair) and two extra numeric validations (deal price) that Collections/Brands don't have. All three list pages already use `PageHeader` — no header migration needed there, only the table and the swallowed-error fix.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), Tailwind v4, shadcn/ui, Vitest + Testing Library (`npm test`).

**Spec:** `docs/superpowers/specs/2026-09-02-admin-redesign-design.md`. Implements the "Collections, Combos, Brands" portion of "Wave 3 — Long tail" (Rollout waves), and the Forms UX section's explicit bullet: "the Product editor... and the Collections/Combos/Brands 'new' forms and Settings sub-pages, currently read as flat stacks of inputs with no grouping and no clear hierarchy." The decorative drag-handle removal and swallowed-error fix are not named in the spec by file — they're found during this plan's own research, matching the same pattern as Wave 2's Dispatch rider-UI removal (a real "decorative UI implying a feature that doesn't exist" bug, the spec's own stated category, just not one it happened to enumerate for this specific file) and every prior wave's swallowed-error fixes.

## Global Constraints

- Every file this plan touches lives under `web/` — no `mobile/`/`supabase/` changes.
- Every Server Action call (`createCollection`, `updateCollection`, `setCollectionFeatured`, `deleteCollection`, `createCombo`, `updateCombo`, `setComboActive`, `deleteCombo`, `createBrand`, `updateBrand`, `setBrandFeatured`, `deleteBrand`) is invoked with the exact same arguments as today — this plan changes visual chrome and form UX, never business logic or the `*Input` payload shapes.
- Do not modify `page-header.tsx`, `data-table.tsx`, `form-section.tsx`, `form-field.tsx`, `status-pill.tsx`, `toggle.tsx`, or any `actions.ts` files' business logic — all pre-existing and depended on elsewhere.
- Every hardcoded hex color and hardcoded shadow/radius bracket touched by a task's target file must become a token/utility. (Research found zero pre-existing violations in these 9 files — this constraint exists to catch any the rewrites might accidentally introduce, not to fix known debt.) Acceptance check: `grep -rn "shadow-\[\|rounded-\[\|text-\[#\|bg-\[#" web/src/app/\(dashboard\)/collections web/src/app/\(dashboard\)/combos web/src/app/\(dashboard\)/brands web/src/components/admin/collection-form.tsx web/src/components/admin/collections-table.tsx web/src/components/admin/combo-form.tsx web/src/components/admin/combos-table.tsx web/src/components/admin/brand-form.tsx web/src/components/admin/brands-table.tsx` must return nothing.
- The decorative `DotsSixVertical` "drag to reorder" icon on Collections' and Brands' tables is removed outright, not replaced with a real drag-and-drop implementation — building actual manual reordering is separate, future scope (matching the exact precedent Wave 2 set for Dispatch's rider UI: remove the dead affordance, don't build the missing feature). `sort_order` itself is untouched — both list pages keep ordering by it, they just lose the fake "you can drag this" cue.
- Run `npx tsc --noEmit` (from `web/`) after every task — must be clean before moving to the next task.
- Run `npm test` (from `web/`) after every task — full suite must pass.

---

## File Structure

Modified files:
- `web/src/app/(dashboard)/collections/page.tsx` — throw on query error, drop the now-redundant hint-text wrapper
- `web/src/components/admin/collections-table.tsx` — full rewrite onto `DataTable`, drop the dead drag handle
- `web/src/app/(dashboard)/combos/page.tsx` — throw on query error
- `web/src/components/admin/combos-table.tsx` — full rewrite onto `DataTable`
- `web/src/app/(dashboard)/brands/page.tsx` — throw on query error, drop the now-redundant hint-text wrapper
- `web/src/components/admin/brands-table.tsx` — full rewrite onto `DataTable`, drop the dead drag handle
- `web/src/components/admin/collection-form.tsx` — full rewrite onto `FormSection`/`FormField`, inline validation
- `web/src/components/admin/brand-form.tsx` — full rewrite onto `FormSection`/`FormField`, inline validation
- `web/src/components/admin/combo-form.tsx` — full rewrite onto `FormSection`/`FormField`, inline validation

New files:
- `web/src/app/(dashboard)/collections/loading.tsx`, `error.tsx`
- `web/src/app/(dashboard)/collections/new/loading.tsx`, `error.tsx`
- `web/src/app/(dashboard)/collections/[slug]/loading.tsx`, `error.tsx`
- `web/src/app/(dashboard)/combos/loading.tsx`, `error.tsx`
- `web/src/app/(dashboard)/combos/new/loading.tsx`, `error.tsx`
- `web/src/app/(dashboard)/combos/[id]/loading.tsx`, `error.tsx`
- `web/src/app/(dashboard)/brands/loading.tsx`, `error.tsx`
- `web/src/app/(dashboard)/brands/new/loading.tsx`, `error.tsx`
- `web/src/app/(dashboard)/brands/[slug]/loading.tsx`, `error.tsx`

Explicitly NOT touched: `collections/actions.ts`, `combos/actions.ts`, `brands/actions.ts`, `combos/variant-options.ts` (business logic, all unchanged), any Products/Customers/Orders files (out of this plan's scope).

---

### Task 1: List pages — `DataTable` migration, swallowed-error fix, dead drag-handle removal

**Files:**
- Modify: `web/src/app/(dashboard)/collections/page.tsx`
- Modify: `web/src/components/admin/collections-table.tsx` (full rewrite)
- Modify: `web/src/app/(dashboard)/combos/page.tsx`
- Modify: `web/src/components/admin/combos-table.tsx` (full rewrite)
- Modify: `web/src/app/(dashboard)/brands/page.tsx`
- Modify: `web/src/components/admin/brands-table.tsx` (full rewrite)

**Interfaces:**
- Consumes: `DataTable`, `DataTableColumn<T>` (`@/components/admin/data-table`, Wave 0, unchanged — `pagination`/`summary` are optional and omitted here, these are small merchant-curated catalogs, not paginated lists).
- Produces: `CollectionsTable({collections})`, `CombosTable({combos})`, `BrandsTable({brands})` — same prop names, same row types (`CollectionRow`, `ComboRow`, `BrandRow`), unchanged.

- [ ] **Step 1: Fix `collections/page.tsx`'s swallowed error, simplify its layout**

Replace the file in full:
```tsx
import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { CollectionsTable, type CollectionRow } from "@/components/admin/collections-table";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const db = createServerClient();
  const { data, error } = await db
    .from("category")
    .select("id, name, slug, is_active, is_featured_home, product(count)")
    .eq("kind", "collection")
    .is("deleted_at", null)
    .order("is_featured_home", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;

  const collections: CollectionRow[] = (data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    slug: c.slug as string,
    active: c.is_active as boolean,
    featured: c.is_featured_home as boolean,
    products: (c.product as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
  const featured = collections.filter((c) => c.featured && c.active).length;

  return (
    <>
      <PageHeader title="Collections" description={`${collections.length} collections · ${featured} on the app home`}>
        <Link
          href="/collections/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Plus weight="duotone" className="size-4" />
          New collection
        </Link>
      </PageHeader>

      <CollectionsTable collections={collections} />
    </>
  );
}
```
(The old ternary — `"Couldn't load collections — check the Supabase keys in web/.env.local."` on error — is gone; a real query failure now throws and the new `error.tsx` from Task 4 catches it. The hint paragraph moves inside `CollectionsTable` itself in Step 2, so its padding matches the table wrapper instead of using the page-header's own `px-6...lg:px-10` scale — a small pre-existing inconsistency this migration also cleans up.)

- [ ] **Step 2: Rewrite `collections-table.tsx` onto `DataTable`**

Replace the file in full:
```tsx
"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Stack, Trash } from "@phosphor-icons/react";

import { deleteCollection, setCollectionFeatured } from "@/app/(dashboard)/collections/actions";
import { formatInt } from "@/lib/format";
import { StatusPill } from "@/components/admin/status-pill";
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
    { header: "Status", render: (c) => <StatusPill tone={c.active ? "success" : "neutral"} dot>{c.active ? "Active" : "Hidden"}</StatusPill> },
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
```
Notes on what changed and why:
- The leading `DotsSixVertical` "drag to reorder" column is gone — it had no `draggable` attribute, no drag event handlers, and no Server Action to persist a reordering; it implied a feature that doesn't exist, the same category of bug as Wave 2's Dispatch rider-UI removal. `sort_order` still drives the query's `ORDER BY` (page.tsx, unchanged) — only the fake "you can drag this" cue is removed.
- Row navigation stays `<Link>`-per-cell (Edit) plus a separate Delete button, rather than `DataTable`'s `onRowClick` — deliberately kept, not an oversight: a destructive Delete button living inside a whole-row `onRowClick` area is a real interaction hazard (an accidental click near Delete could trigger row navigation instead, or vice versa), so explicit per-action controls are the correct choice here, matching Wave 1's identical reasoning for keeping `ProductsTable` on `<Link>`-per-cell.
- The trailing actions column's `header: ""` is intentional — matches the visual convention of an unlabeled actions column, not a placeholder oversight.

- [ ] **Step 3: Fix `combos/page.tsx`'s swallowed error**

Replace only the `error` handling and `PageHeader`/return block — the data-fetching and mapping logic (lines computing `combos` from `data`) stays exactly as it is; add `if (error) throw error;` right after the query and simplify the `description`:
```tsx
  const { data, error } = await db
    .from("combo")
    .select("id, name, slug, is_active, combo_price_minor, combo_item(qty, product_variant(price_minor, product(name)))")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const combos: ComboRow[] = ((data ?? []) as unknown as Raw[]).map((c) => {
```
and:
```tsx
      <PageHeader title="Combos" description={`${combos.length} combos · ${active} live`}>
```
(dropping the old `error ? "Couldn't load combos..." : ...` ternary). The `<p className="px-6 pt-4 ...">` hint text moves into `CombosTable` in Step 4, same as Collections.

- [ ] **Step 4: Rewrite `combos-table.tsx` onto `DataTable`**

Replace the file in full:
```tsx
"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Cards, Trash } from "@phosphor-icons/react";

import { deleteCombo, setComboActive } from "@/app/(dashboard)/combos/actions";
import { formatLe } from "@/lib/format";
import { StatusPill } from "@/components/admin/status-pill";
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
    { header: "Status", render: (c) => <StatusPill tone={c.active ? "success" : "neutral"} dot>{c.active ? "Active" : "Hidden"}</StatusPill> },
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
```
(Combos never had the dead drag-handle column — nothing to remove there, only the `DataTable` migration itself.)

- [ ] **Step 5: Fix `brands/page.tsx`'s swallowed error**

Same shape as Step 1/3 — add `if (error) throw error;` right after the query, simplify the description:
```tsx
  const { data, error } = await db
    .from("brand")
    .select("id, name, slug, is_active, is_featured_home, product(count)")
    .is("deleted_at", null)
    .order("is_featured_home", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;

  const brands: BrandRow[] = (data ?? []).map((b) => ({
```
and:
```tsx
      <PageHeader title="Brands" description={`${brands.length} brands · ${featured} featured on the app home`}>
```
The hint paragraph moves into `BrandsTable` in Step 6.

- [ ] **Step 6: Rewrite `brands-table.tsx` onto `DataTable`**

Replace the file in full:
```tsx
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
```
(Same dead drag-handle removal as Collections.)

- [ ] **Step 7: Typecheck and run the full suite**

Run: `cd web && npx tsc --noEmit && npm test`
Expected: no type errors; all existing suites pass.

- [ ] **Step 8: Manually verify**

Run `npm run dev`, open `/collections`, `/combos`, `/brands`. Confirm: each table renders with square corners, no leftover drag-handle icon on Collections/Brands, toggling "featured"/"active" still works, Delete still prompts and removes a row, Edit still navigates to the right detail page.

- [ ] **Step 9: Commit**

```bash
git add "web/src/app/(dashboard)/collections/page.tsx" web/src/components/admin/collections-table.tsx "web/src/app/(dashboard)/combos/page.tsx" web/src/components/admin/combos-table.tsx "web/src/app/(dashboard)/brands/page.tsx" web/src/components/admin/brands-table.tsx
git commit -m "feat(admin): migrate Collections/Combos/Brands lists onto DataTable, fix swallowed errors, remove dead drag handles

All three list pages threw away their Supabase query's error into a
dev-facing 'check the Supabase keys' string instead of surfacing it —
now they throw, matching the pattern already fixed on every other list
page in this redesign. Collections' and Brands' tables had a
DotsSixVertical 'drag to reorder' icon with no backing drag
implementation and no Server Action to persist a reorder — removed
outright rather than built out, the same treatment Wave 2 gave
Dispatch's dead rider-assignment UI. All three tables now compose
DataTable instead of hand-rolling their own <table> shell.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `CollectionForm` + `BrandForm` — `FormSection`/`FormField`, inline validation

**Files:**
- Modify: `web/src/components/admin/collection-form.tsx` (full rewrite)
- Modify: `web/src/components/admin/brand-form.tsx` (full rewrite)

**Interfaces:**
- Consumes: `FormSection` (`@/components/admin/form-section`), `FormField` (`@/components/admin/form-field`, single-element `children`, does not inject `id`).
- Produces: `CollectionForm({initial?})`, `BrandForm({initial?})` — same prop signatures, same `CollectionValues`/`BrandValues` types, unchanged.

These two forms are structurally identical (Name, Slug, an optional field or two, two visibility toggles) — batched into one task since the same mechanical fix applies to both with no shared file conflict.

- [ ] **Step 1: Rewrite `collection-form.tsx`**

Replace the file in full:
```tsx
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { ArrowLeft, UploadSimple } from "@phosphor-icons/react";

import { createCollection, updateCollection } from "@/app/(dashboard)/collections/actions";
import { Toggle } from "@/components/admin/toggle";
import { FormSection } from "@/components/admin/form-section";
import { FormField } from "@/components/admin/form-field";

export type CollectionValues = {
  id?: string;
  name?: string;
  slug?: string;
  active?: boolean;
  featured?: boolean;
};

const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";

const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function CollectionForm({ initial }: { initial?: CollectionValues }) {
  const router = useRouter();
  const uid = useId();
  const editing = Boolean(initial?.id);
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [nameTouched, setNameTouched] = useState(Boolean(initial?.name));
  const [active, setActive] = useState(initial?.active ?? true);
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const nameRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);

  function save() {
    setError(null);
    if (!name.trim()) {
      setNameTouched(true);
      nameRef.current?.focus();
      return;
    }
    if (!slug.trim()) {
      setSlugTouched(true);
      slugRef.current?.focus();
      return;
    }
    const input = { name, slug, active, featured };
    start(async () => {
      const res = editing ? await updateCollection(initial!.id!, input) : await createCollection(input);
      if (res.ok) router.push("/collections");
      else setError(res.error);
    });
  }

  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Link href="/collections" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Collections
        </Link>
        <div className="mt-3 flex items-center justify-between gap-3">
          <h1 className="font-display text-xl font-semibold tracking-tight">{editing ? initial?.name : "New collection"}</h1>
          <div className="flex items-center gap-2">
            <Link href="/collections" className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Cancel
            </Link>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : editing ? "Save changes" : "Create collection"}
            </button>
          </div>
        </div>
      </div>

      <form className="mx-auto max-w-2xl space-y-6 px-6 py-8 lg:px-10" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">{error}</p>
        ) : null}

        <FormSection title="Details">
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-foreground">Cover image <span className="font-normal text-muted-foreground">— optional</span></p>
            <p className="mt-0.5 text-xs text-muted-foreground">Shown on the app home card. Upload to Storage is coming with media management.</p>
            <span className="mt-2 grid aspect-[16/9] w-full max-w-sm place-items-center rounded-lg border border-dashed border-border text-muted-foreground">
              <span className="flex flex-col items-center gap-1.5 text-xs">
                <UploadSimple weight="duotone" className="size-5" />
                Upload cover
              </span>
            </span>
          </div>
          <FormField label="Name" htmlFor={`${uid}-name`} error={nameTouched && !name.trim() ? "Name is required." : undefined}>
            <input
              ref={nameRef}
              id={`${uid}-name`}
              className={inputClass}
              value={name}
              onChange={(e) => { setName(e.target.value); setNameTouched(true); if (!slugTouched) setSlug(slugify(e.target.value)); }}
              placeholder="e.g. Date night"
            />
          </FormField>
          <FormField label="Slug" htmlFor={`${uid}-slug`} helper="Used in links — lowercase, no spaces." error={slugTouched && !slug.trim() ? "Slug is required." : undefined}>
            <input
              ref={slugRef}
              id={`${uid}-slug`}
              className={inputClass}
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
              placeholder="date-night"
            />
          </FormField>
        </FormSection>

        <FormSection title="Visibility">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-[13px] font-medium">Active</p><p className="text-xs text-muted-foreground">Show this collection in the app.</p></div>
            <Toggle defaultOn={active} label="Active" onChange={setActive} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-[13px] font-medium">Feature on app home</p><p className="text-xs text-muted-foreground">Include in the home collections rail.</p></div>
            <Toggle defaultOn={featured} label="Feature on app home" onChange={setFeatured} />
          </div>
        </FormSection>
      </form>
    </>
  );
}
```
Notes: the header font gains `font-display`, matching every other detail/form header migrated so far. The old local `Field`/`ToggleRow` helpers are retired — Name/Slug use `FormField` directly; the Active/Featured toggles are direct `FormSection` children (not wrapped in `FormField`, matching the exact precedent set for Product Editor's and Customer detail's toggles: `Toggle` has no `id` prop to wire `htmlFor` to, and it's out of scope to modify `toggle.tsx`, which is shared with 12+ other files). The Cover-image placeholder isn't a real input, so it's plain `FormSection` content, not a `FormField` — same treatment as Product Editor's non-field descriptive blocks. Client-side validation is new: `save()` now checks Name/Slug locally and focuses the first invalid field before ever calling the Server Action, rather than relying entirely on the Action's generic "Name and slug are required." string.

- [ ] **Step 2: Rewrite `brand-form.tsx`**

Replace the file in full:
```tsx
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { ArrowLeft, UploadSimple } from "@phosphor-icons/react";

import { createBrand, updateBrand } from "@/app/(dashboard)/brands/actions";
import { Toggle } from "@/components/admin/toggle";
import { FormSection } from "@/components/admin/form-section";
import { FormField } from "@/components/admin/form-field";

export type BrandValues = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  active?: boolean;
  featured?: boolean;
};

const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";

const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function BrandForm({ initial }: { initial?: BrandValues }) {
  const router = useRouter();
  const uid = useId();
  const editing = Boolean(initial?.id);
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [nameTouched, setNameTouched] = useState(Boolean(initial?.name));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const nameRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);

  function save() {
    setError(null);
    if (!name.trim()) {
      setNameTouched(true);
      nameRef.current?.focus();
      return;
    }
    if (!slug.trim()) {
      setSlugTouched(true);
      slugRef.current?.focus();
      return;
    }
    const input = { name, slug, description: description || null, active, featured };
    start(async () => {
      const res = editing ? await updateBrand(initial!.id!, input) : await createBrand(input);
      if (res.ok) router.push("/brands");
      else setError(res.error);
    });
  }

  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Link href="/brands" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Brands
        </Link>
        <div className="mt-3 flex items-center justify-between gap-3">
          <h1 className="font-display text-xl font-semibold tracking-tight">{editing ? initial?.name : "New brand"}</h1>
          <div className="flex items-center gap-2">
            <Link href="/brands" className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Cancel
            </Link>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : editing ? "Save changes" : "Create brand"}
            </button>
          </div>
        </div>
      </div>

      <form className="mx-auto max-w-2xl space-y-6 px-6 py-8 lg:px-10" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">{error}</p>
        ) : null}

        <FormSection title="Details">
          <div className="sm:col-span-2 flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-lg border border-dashed border-border text-muted-foreground">
              <UploadSimple weight="duotone" className="size-5" />
            </span>
            <div>
              <p className="text-xs font-medium text-foreground">Logo <span className="font-normal text-muted-foreground">— optional</span></p>
              <p className="text-xs text-muted-foreground">Square PNG or SVG. Image upload to Storage is coming with media management.</p>
            </div>
          </div>
          <FormField label="Name" htmlFor={`${uid}-name`} error={nameTouched && !name.trim() ? "Name is required." : undefined}>
            <input
              ref={nameRef}
              id={`${uid}-name`}
              className={inputClass}
              value={name}
              onChange={(e) => { setName(e.target.value); setNameTouched(true); if (!slugTouched) setSlug(slugify(e.target.value)); }}
              placeholder="e.g. Velvet & Oud"
            />
          </FormField>
          <FormField label="Slug" htmlFor={`${uid}-slug`} helper="Used in links — lowercase, no spaces." error={slugTouched && !slug.trim() ? "Slug is required." : undefined}>
            <input
              ref={slugRef}
              id={`${uid}-slug`}
              className={inputClass}
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
              placeholder="velvet-oud"
            />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Description" htmlFor={`${uid}-description`} optional>
              <textarea
                id={`${uid}-description`}
                rows={3}
                className={`${inputClass} h-auto resize-y py-2`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short line shown on the brand page."
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Visibility">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-[13px] font-medium">Active</p><p className="text-xs text-muted-foreground">Show this brand and its products in the app.</p></div>
            <Toggle defaultOn={active} label="Active" onChange={setActive} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-[13px] font-medium">Feature on app home</p><p className="text-xs text-muted-foreground">Include in the home &ldquo;Shop by brand&rdquo; rail.</p></div>
            <Toggle defaultOn={featured} label="Feature on app home" onChange={setFeatured} />
          </div>
        </FormSection>
      </form>
    </>
  );
}
```

- [ ] **Step 3: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass.

- [ ] **Step 4: Manually verify**

Run `npm run dev`, open `/collections/new` and `/brands/new`. Confirm: header renders in the serif font; Name and Slug show visible labels; clicking Create/Save with an empty Name focuses it and shows an inline error; filling Name auto-fills Slug as before; editing an existing collection/brand still saves correctly.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/admin/collection-form.tsx web/src/components/admin/brand-form.tsx
git commit -m "feat(admin): rework Collection/Brand forms onto FormSection/FormField with inline validation

Retires the local Field/ToggleRow helpers. Name and Slug now validate
client-side before the Server Action is called — an empty required
field focuses itself and shows an inline error instead of relying
entirely on the Action's generic 'Name and slug are required.' string.
Header font brought in line with every other migrated form (font-display).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `ComboForm` — `FormSection`/`FormField`, fragrance picker, inline deal-price validation

**Files:**
- Modify: `web/src/components/admin/combo-form.tsx` (full rewrite)

**Interfaces:**
- Consumes: `FormSection`, `FormField` (same contracts as Task 2).
- Produces: `ComboForm({initial?, variants})` — same prop signature, same `ComboValues`/`VariantOption` types, unchanged.

This form is meaningfully more complex than Collections/Brands: a repeating fragrance picker (add/remove/qty-adjust) and a deal-price field with two distinct validation rules (must be a positive number; must be below the pair's sum). Both validations currently surface as one shared global banner — this task splits them into their own states so each shows in the right place, the same discipline Wave 2 applied to `CustomerLoyalty`'s grant/tier errors.

- [ ] **Step 1: Rewrite `combo-form.tsx`**

Replace the file in full:
```tsx
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useId, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Minus, Plus, X } from "@phosphor-icons/react";

import { createCombo, updateCombo } from "@/app/(dashboard)/combos/actions";
import { formatLe } from "@/lib/format";
import { Toggle } from "@/components/admin/toggle";
import { FormSection } from "@/components/admin/form-section";
import { FormField } from "@/components/admin/form-field";

export type VariantOption = { id: string; label: string; priceMinor: number };
export type ComboValues = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  active?: boolean;
  items?: { variantId: string; qty: number }[];
  dealPriceMinor?: number | null;
};

const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";

const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function ComboForm({ initial, variants }: { initial?: ComboValues; variants: VariantOption[] }) {
  const router = useRouter();
  const uid = useId();
  const editing = Boolean(initial?.id);
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [nameTouched, setNameTouched] = useState(Boolean(initial?.name));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [items, setItems] = useState<{ variantId: string; qty: number }[]>(initial?.items ?? []);
  // Deal price is edited in whole Leones; stored as minor units. Blank = no deal.
  const [deal, setDeal] = useState(initial?.dealPriceMinor != null ? String(initial.dealPriceMinor / 100) : "");
  const [error, setError] = useState<string | null>(null);
  const [itemsErr, setItemsErr] = useState<string | null>(null);
  const [dealErr, setDealErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const nameRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const dealRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const chosen = new Set(items.map((i) => i.variantId));
  const available = variants.filter((v) => !chosen.has(v.id));
  const sumMinor = items.reduce((s, it) => s + (byId.get(it.variantId)?.priceMinor ?? 0) * it.qty, 0);
  const dealMinor = deal.trim() === "" ? null : Math.round(Number(deal) * 100);
  const dealValid = dealMinor == null || (Number.isFinite(dealMinor) && dealMinor > 0);
  const savingsMinor = dealMinor != null && dealValid && dealMinor < sumMinor ? sumMinor - dealMinor : 0;

  const addItem = (variantId: string) => { setItems((prev) => [...prev, { variantId, qty: 1 }]); setItemsErr(null); };
  const setQty = (variantId: string, qty: number) =>
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.variantId !== variantId) : prev.map((i) => (i.variantId === variantId ? { ...i, qty } : i))));
  const removeItem = (variantId: string) => setItems((prev) => prev.filter((i) => i.variantId !== variantId));

  function save() {
    setError(null);
    setItemsErr(null);
    setDealErr(null);
    if (!name.trim()) {
      setNameTouched(true);
      nameRef.current?.focus();
      return;
    }
    if (!slug.trim()) {
      setSlugTouched(true);
      slugRef.current?.focus();
      return;
    }
    if (items.length < 2) {
      setItemsErr("A combo needs at least two fragrances.");
      return;
    }
    if (dealMinor != null && !dealValid) {
      setDealErr("Deal price must be a positive amount, or left blank.");
      dealRef.current?.focus();
      return;
    }
    if (dealMinor != null && dealMinor >= sumMinor) {
      setDealErr("Deal price must be below the pair's sum — otherwise it isn't a discount. Leave it blank to charge the sum.");
      dealRef.current?.focus();
      return;
    }
    const input = { name, slug, description, active, items, dealPriceMinor: dealMinor };
    start(async () => {
      const res = editing ? await updateCombo(initial!.id!, input) : await createCombo(input);
      if (res.ok) router.push("/combos");
      else setError(res.error);
    });
  }

  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Link href="/combos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Combos
        </Link>
        <div className="mt-3 flex items-center justify-between gap-3">
          <h1 className="font-display text-xl font-semibold tracking-tight">{editing ? initial?.name : "New combo"}</h1>
          <div className="flex items-center gap-2">
            <Link href="/combos" className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Cancel
            </Link>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : editing ? "Save changes" : "Create combo"}
            </button>
          </div>
        </div>
      </div>

      <form className="mx-auto max-w-2xl space-y-6 px-6 py-8 lg:px-10" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">{error}</p>
        ) : null}

        <FormSection title="Details">
          <FormField label="Name" htmlFor={`${uid}-name`} error={nameTouched && !name.trim() ? "Name is required." : undefined}>
            <input
              ref={nameRef}
              id={`${uid}-name`}
              className={inputClass}
              value={name}
              onChange={(e) => { setName(e.target.value); setNameTouched(true); if (!slugTouched) setSlug(slugify(e.target.value)); }}
              placeholder="e.g. The Signature Pair"
            />
          </FormField>
          <FormField label="Slug" htmlFor={`${uid}-slug`} helper="Used in links — lowercase, no spaces." error={slugTouched && !slug.trim() ? "Slug is required." : undefined}>
            <input
              ref={slugRef}
              id={`${uid}-slug`}
              className={inputClass}
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
              placeholder="signature-pair"
            />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Description" htmlFor={`${uid}-description`} optional helper="Shown on the pair's page.">
              <textarea
                id={`${uid}-description`}
                className={`${inputClass} h-20 py-2`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Two scents curated to wear together — day into night."
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Fragrances in the pair" description="Add two or more. Customers can add the whole pair to their bag in one tap.">
          <div className="sm:col-span-2">
            <div className="divide-y divide-border rounded-md border border-border">
              {items.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">No fragrances yet — add the first below.</p>
              ) : (
                items.map((it) => {
                  const v = byId.get(it.variantId);
                  return (
                    <div key={it.variantId} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{v?.label ?? "Unavailable fragrance"}</div>
                        <div className="nums text-xs text-muted-foreground">{formatLe((v?.priceMinor ?? 0) * it.qty)}</div>
                      </div>
                      <div className="flex items-center rounded-md border border-border">
                        <button type="button" className="grid size-8 place-items-center text-muted-foreground hover:text-foreground" aria-label="Decrease" onClick={() => setQty(it.variantId, it.qty - 1)}>
                          <Minus className="size-3.5" />
                        </button>
                        <span className="nums w-6 text-center text-sm">{it.qty}</span>
                        <button type="button" className="grid size-8 place-items-center text-muted-foreground hover:text-foreground" aria-label="Increase" onClick={() => setQty(it.variantId, it.qty + 1)}>
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <button type="button" className="text-muted-foreground transition-colors hover:text-destructive" aria-label="Remove" onClick={() => removeItem(it.variantId)}>
                        <X className="size-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <select
              className={`${inputClass} mt-3`}
              value=""
              onChange={(e) => { if (e.target.value) addItem(e.target.value); }}
              disabled={available.length === 0}
              aria-label="Add a fragrance"
            >
              <option value="">{available.length === 0 ? "All fragrances added" : "Add a fragrance…"}</option>
              {available.map((v) => (
                <option key={v.id} value={v.id}>{v.label} · {formatLe(v.priceMinor)}</option>
              ))}
            </select>
            {itemsErr ? <p className="mt-1.5 text-xs text-destructive">{itemsErr}</p> : null}

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">Sum of fragrances</span>
              <span className="nums text-sm">{formatLe(sumMinor)}</span>
            </div>
          </div>
        </FormSection>

        <FormSection title="Pricing">
          <FormField
            label="Deal price"
            htmlFor={`${uid}-deal`}
            optional
            error={dealErr ?? undefined}
            helper={
              !dealErr
                ? savingsMinor > 0
                  ? `Customers save ${formatLe(savingsMinor)} versus buying the fragrances separately.`
                  : `Set a price below ${formatLe(sumMinor)} to offer the pair as a deal. Blank charges the honest sum.`
                : undefined
            }
          >
            <div className="relative max-w-xs">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Le</span>
              <input
                ref={dealRef}
                id={`${uid}-deal`}
                className={`${inputClass} pl-9`}
                inputMode="decimal"
                value={deal}
                onChange={(e) => { setDeal(e.target.value.replace(/[^0-9.]/g, "")); setDealErr(null); }}
                placeholder={sumMinor ? String(Math.round(sumMinor / 100)) : "0"}
              />
            </div>
          </FormField>
        </FormSection>

        <FormSection title="Visibility">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-[13px] font-medium">Active</p><p className="text-xs text-muted-foreground">Show this pair in the app (needs every fragrance in stock).</p></div>
            <Toggle defaultOn={active} label="Active" onChange={setActive} />
          </div>
        </FormSection>
      </form>
    </>
  );
}
```
Notes on deliberate deviations (confirm these read as intentional in review):
- **The fragrance picker is not `FormField`-wrapped** — it's a repeating list of whole variant records (add/remove/qty), the same shape as Product Editor's Variants block, not a single labeled input. It gets its own `FormSection` ("Fragrances in the pair") with the section's own `description` slot carrying the old inline hint text, matching the section-level-description convention `FormSection` already supports.
- **`itemsErr`** ("A combo needs at least two fragrances.") renders directly under the picker/add-select, not through `FormField`, for the same reason — there's no single field it belongs to.
- **`dealErr`** replaces the old combined logic where both "invalid number" and "below the sum" checks fed one shared `error` banner. Both now render inline under the Deal price field via `FormField`'s `error` prop, and the savings/hint text is demoted to `FormField`'s `helper` slot (hidden automatically whenever `error` is set, matching `FormField`'s own `message = error ?? helper` precedence — no extra logic needed beyond passing `helper={!dealErr ? ... : undefined}` defensively for clarity).
- The global `error` banner is now reserved for genuine server-side failures only (e.g. a duplicate slug constraint) — every client-catchable validation case has its own specific home.

- [ ] **Step 2: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass.

- [ ] **Step 3: Manually verify**

Run `npm run dev`, open `/combos/new`. Confirm: header renders in the serif font; adding fewer than two fragrances and clicking Create shows the inline "needs at least two fragrances" message under the picker; entering a deal price at or above the sum shows an inline error under Deal price (not a page-top banner) and focuses that field; a valid deal price shows the savings line; editing an existing combo still saves correctly with its items intact.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/admin/combo-form.tsx
git commit -m "feat(admin): rework ComboForm onto FormSection/FormField, split validation into field-level errors

Name/Slug validate client-side before the Server Action runs, same as
Collections/Brands. The 'needs two fragrances' and 'deal price invalid'
checks — previously one shared global banner regardless of which was
wrong — now each render at the specific field or block they describe,
following the same discipline Wave 2 applied to CustomerLoyalty's
grant/tier error split.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `loading.tsx` + `error.tsx` for all 9 routes

Deliberately last — Tasks 1-3 restructure every page's layout (list pages onto `DataTable`, forms onto `FormSection`); writing skeletons against the final shapes avoids the skeleton/header-mismatch class of bug found in Wave 1's final review.

**Files:**
- Create: `web/src/app/(dashboard)/collections/loading.tsx`, `error.tsx`
- Create: `web/src/app/(dashboard)/collections/new/loading.tsx`, `error.tsx`
- Create: `web/src/app/(dashboard)/collections/[slug]/loading.tsx`, `error.tsx`
- Create: `web/src/app/(dashboard)/combos/loading.tsx`, `error.tsx`
- Create: `web/src/app/(dashboard)/combos/new/loading.tsx`, `error.tsx`
- Create: `web/src/app/(dashboard)/combos/[id]/loading.tsx`, `error.tsx`
- Create: `web/src/app/(dashboard)/brands/loading.tsx`, `error.tsx`
- Create: `web/src/app/(dashboard)/brands/new/loading.tsx`, `error.tsx`
- Create: `web/src/app/(dashboard)/brands/[slug]/loading.tsx`, `error.tsx`

**Interfaces:**
- Consumes: `Skeleton` (`@/components/ui/skeleton`), `TableSkeleton` (`@/components/admin/table-skeleton`), `PageError` (`@/components/admin/page-error`) — all pre-existing.

This is one batched task — all 18 files follow one of two templates (list-page skeleton with `PageHeader`'s exact box classes + `TableSkeleton`; form-page skeleton with a back-link bar + `FormSection`-shaped blocks), repeated per route with only titles/column-counts differing.

- [ ] **Step 1: List page loading/error (Collections, Combos, Brands)**

Template for each list page's `loading.tsx` (5 columns for Collections/Brands, 6 for Combos — matching each table's actual column count from Task 1):

`web/src/app/(dashboard)/collections/loading.tsx`:
```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/admin/table-skeleton";

export default function CollectionsLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-28" />
          <Skeleton className="mt-1.5 h-3 w-56" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="px-5 pb-6 pt-2">
        <Skeleton className="mb-3 h-3 w-72" />
        <TableSkeleton columns={5} rows={8} />
      </div>
    </>
  );
}
```

`web/src/app/(dashboard)/collections/error.tsx`:
```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function CollectionsError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load collections" reset={reset} />;
}
```

`web/src/app/(dashboard)/combos/loading.tsx` (identical shape, `columns={6}`, adjust widths/copy):
```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/admin/table-skeleton";

export default function CombosLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-1.5 h-3 w-40" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="px-5 pb-6 pt-2">
        <Skeleton className="mb-3 h-3 w-96" />
        <TableSkeleton columns={6} rows={8} />
      </div>
    </>
  );
}
```

`web/src/app/(dashboard)/combos/error.tsx`:
```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function CombosError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load combos" reset={reset} />;
}
```

`web/src/app/(dashboard)/brands/loading.tsx` (`columns={5}`):
```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/admin/table-skeleton";

export default function BrandsLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-20" />
          <Skeleton className="mt-1.5 h-3 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="px-5 pb-6 pt-2">
        <Skeleton className="mb-3 h-3 w-72" />
        <TableSkeleton columns={5} rows={8} />
      </div>
    </>
  );
}
```

`web/src/app/(dashboard)/brands/error.tsx`:
```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function BrandsError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load brands" reset={reset} />;
}
```

- [ ] **Step 2: Form-page loading/error (new + detail, all three areas)**

Every "new" and "[slug]"/"[id]" route shares one form shell (back-link bar, then a `max-w-2xl` column of `FormSection`-shaped blocks). Since `new` pages render `<CollectionForm />`/`<BrandForm />` with no `initial` (a Server Component with no data fetch — `new/page.tsx` is not `async` and needs no `loading.tsx` for a data-fetch reason, but gets one anyway for route-transition consistency with its sibling `[slug]`/`[id]` routes, which do fetch data), all six form-shaped `loading.tsx` files use this same template, varying only the header-skeleton width and section-block count/heights to roughly match each form's actual number of `FormSection`s:

`web/src/app/(dashboard)/collections/new/loading.tsx` (2 sections: Details, Visibility):
```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function NewCollectionLoading() {
  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Skeleton className="h-3.5 w-24" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="mx-auto max-w-2xl space-y-6 px-6 py-8 lg:px-10">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </>
  );
}
```
Create `web/src/app/(dashboard)/collections/[slug]/loading.tsx` as an identical copy (same shape, editing an existing collection renders the same two sections).

`web/src/app/(dashboard)/collections/new/error.tsx` and `web/src/app/(dashboard)/collections/[slug]/error.tsx` (same title, both routes fail the same way from the shop owner's perspective):
```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function CollectionFormError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load this collection" reset={reset} />;
}
```

`web/src/app/(dashboard)/brands/new/loading.tsx` and `web/src/app/(dashboard)/brands/[slug]/loading.tsx` (same template, Brands' Details section is taller — Logo + Name + Slug + Description):
```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function NewBrandLoading() {
  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Skeleton className="h-3.5 w-16" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="mx-auto max-w-2xl space-y-6 px-6 py-8 lg:px-10">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </>
  );
}
```

`web/src/app/(dashboard)/brands/new/error.tsx` and `web/src/app/(dashboard)/brands/[slug]/error.tsx`:
```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function BrandFormError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load this brand" reset={reset} />;
}
```

`web/src/app/(dashboard)/combos/new/loading.tsx` and `web/src/app/(dashboard)/combos/[id]/loading.tsx` (4 sections: Details, Fragrances, Pricing, Visibility):
```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function NewComboLoading() {
  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Skeleton className="h-3.5 w-20" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="mx-auto max-w-2xl space-y-6 px-6 py-8 lg:px-10">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </>
  );
}
```

`web/src/app/(dashboard)/combos/new/error.tsx` and `web/src/app/(dashboard)/combos/[id]/error.tsx`:
```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function ComboFormError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load this combo" reset={reset} />;
}
```

- [ ] **Step 3: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass.

- [ ] **Step 4: Manually verify**

Run `npm run dev`, throttle network (DevTools → Slow 3G) or trust each skeleton's shape by eye — confirm each of the 9 routes' skeleton roughly matches its loaded layout, and that navigating to a nonexistent collection/combo/brand slug still correctly hits `notFound()` (unaffected by this task — no `[slug]`/`[id]` `page.tsx` files were touched in this plan at all, only their new `loading.tsx`/`error.tsx` siblings).

- [ ] **Step 5: Commit**

```bash
git add "web/src/app/(dashboard)/collections/loading.tsx" "web/src/app/(dashboard)/collections/error.tsx" "web/src/app/(dashboard)/collections/new/loading.tsx" "web/src/app/(dashboard)/collections/new/error.tsx" "web/src/app/(dashboard)/collections/[slug]/loading.tsx" "web/src/app/(dashboard)/collections/[slug]/error.tsx" "web/src/app/(dashboard)/combos/loading.tsx" "web/src/app/(dashboard)/combos/error.tsx" "web/src/app/(dashboard)/combos/new/loading.tsx" "web/src/app/(dashboard)/combos/new/error.tsx" "web/src/app/(dashboard)/combos/[id]/loading.tsx" "web/src/app/(dashboard)/combos/[id]/error.tsx" "web/src/app/(dashboard)/brands/loading.tsx" "web/src/app/(dashboard)/brands/error.tsx" "web/src/app/(dashboard)/brands/new/loading.tsx" "web/src/app/(dashboard)/brands/new/error.tsx" "web/src/app/(dashboard)/brands/[slug]/loading.tsx" "web/src/app/(dashboard)/brands/[slug]/error.tsx"
git commit -m "feat(admin): add loading/error states to all 9 Collections/Combos/Brands routes

Authored against the DataTable/FormSection layouts Tasks 1-3 shipped,
not the old hand-rolled layouts — sequenced last specifically to avoid
the skeleton/header mismatch Wave 1's final review found and fixed on
three list pages.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

(Completed during plan-writing, not left for the executor.)

- **Spec coverage:** The Forms UX section's explicit "Collections/Combos/Brands 'new' forms" bullet is covered by Tasks 2-3 (grouping, always-visible labels, mark-optional-not-required, inline field-level errors — including splitting ComboForm's previously-shared error banner into per-location messages). The general repo-wide hex/shadow/header problems (#1-#3) don't apply here (research confirmed zero violations in all 9 files pre-migration) beyond the Global Constraints' acceptance grep, included as a guard against regressions the rewrites might introduce.
- **Placeholder scan:** none found — every task gives literal target code for every file it touches.
- **Type consistency:** `CollectionRow`/`ComboRow`/`BrandRow`, `CollectionValues`/`ComboValues`/`BrandValues`, `VariantOption` are each defined once and referenced identically across the task that touches them; none change shape from before this plan, only the components rendering around them.
- **Scope:** The dead drag-handle removal and swallowed-error fixes are disclosed upfront in this plan's own header and Global Constraints, not discovered silently mid-task — matching how every prior wave has surfaced unprompted-but-precedented bug fixes. `collections/actions.ts`, `combos/actions.ts`, `brands/actions.ts`, and `combos/variant-options.ts` are explicitly out of scope and confirmed untouched by every task. Real drag-and-drop reordering is explicitly named as future scope, not built here.

# Admin Redesign — Product Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Product Detail page's six-panel undifferentiated scroll into tabs, migrate the five read/mutate sub-panels onto the shared `Card` primitives (eliminating every hardcoded hex/shadow left in the Products surface), and rework `ProductEditor` — the app's most complex form — onto `FormSection`/`FormField` with real dirty-state gating, inline field errors, focus-on-error, and an unsaved-changes navigation guard, per the spec's "Forms UX" section.

**Architecture:** Five of the six sub-panels (`ProductImages`, `ProductInventory`, `ProductReviews`, `ProductRestock`, `ProductSignals`) share one copy-pasted card shell (`rounded-[12px] border border-border bg-card shadow-[0_1px_0_rgba(26,26,26,0.07)]`, hand-rolled headers) — Task 1 migrates all five onto `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardAction` in one batch, since it's the same mechanical fix repeated five times. `ProductEditor` (Task 2) is architecturally different — a 307-line stateful form — and gets its own task: local `Field`/`Section` helpers are retired in favor of `FormSection`/`FormField` everywhere that fits cleanly, with two documented exceptions (the Notes trio, the Variants repeating list) where the real shape of the data doesn't fit FormField's single-field contract. Task 2 also introduces this plan's only new shared file, `unsaved-changes-guard.tsx`, scoped locally to this page's needs (not a generic app-wide utility). Tasks 3 and 4 restructure the two pages that render these pieces (`products/[id]/page.tsx` into `Tabs`, `products/new/page.tsx`'s header) — both depend on Tasks 1 and 2 being done first. Task 5 (loading/error boundaries) is **deliberately last**: Wave 1's final review found that a `loading.tsx` skeleton written before a page's real header/layout changed goes stale the moment that layout ships. Task 5 is authored against the tabbed structure Tasks 3-4 produce, not the old scroll layout, so that mismatch can't happen here.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), Tailwind v4, shadcn/ui, `@base-ui/react/tabs`, Vitest + Testing Library (`npm test`).

**Spec:** `docs/superpowers/specs/2026-09-02-admin-redesign-design.md`. This plan implements the piece of the spec's "Wave 1 — Core operations" that Wave 1's own plan (`docs/superpowers/plans/2026-09-04-admin-redesign-wave-1-lists.md`) explicitly deferred: "Products detail (`products/[id]/page.tsx` and its 6 sub-components)". The spec's only explicit structural directive for this page is "split into tabs instead of one long scroll" (Rollout waves, Wave 1) — it does not name the tabs; that decision is made in Task 3 below. The spec's "Forms UX" section (quoted where relevant in Task 2) names the Product editor by name as the form this pass is written for.

## Global Constraints

- Every file this plan touches lives under `web/` — no `mobile/` or `supabase/` changes, no new migrations.
- Every Server Action call (`saveProduct`, `receiveStock`, `adjustStock`, `stocktake`, `setReviewStatus`, `uploadProductImage`, `setPrimaryImage`, `reorderImages`, `deleteProductImage`) is invoked with the exact same arguments it is today. This plan changes visual chrome and form UX around these calls — never their business logic, their argument shapes, or their success/failure handling.
- Do not modify `page-header.tsx`, `data-table.tsx`, `empty-state.tsx`, `stat-card.tsx`, `form-section.tsx`, `form-field.tsx`, `revenue-chart.tsx`, `chart.tsx`, `products-table.tsx`, `inventory-table.tsx`, or `orders-table.tsx` — all already shipped and depended on by other pages. **One exception:** `web/src/components/ui/card.tsx` — Task 1's first step fixes `CardTitle`'s default font class (`font-heading`, which resolves to Inter — pre-redesign — instead of `font-display`, the redesign's serif token). `CardTitle` has zero consumers anywhere in the codebase today (confirmed via `grep -rln "CardTitle" web/src/` — only `card.tsx` itself matches), so this is a zero-blast-radius correction to what would otherwise be the wrong default for every future consumer, not a change to an established, depended-on component.
- Do not modify `web/src/components/admin/toggle.tsx` — it's used in 12 other admin files outside this plan's scope (collections, brands, combos, storefront, onboarding, zones, loyalty, notifications). Task 2 works around its lack of an `id`/ref-forwarding prop rather than extending it.
- Every hardcoded hex color (`text-[#...]`, `bg-[#...]`, `hover:bg-[#...]`) and hardcoded shadow/radius bracket (`shadow-[...]`, `rounded-[...]`) touched by a task's target file must become the corresponding token/utility. Acceptance check: `grep -rn "shadow-\[\|rounded-\[\|text-\[#\|bg-\[#" web/src/app/\(dashboard\)/products web/src/components/admin/product-*.tsx` must return nothing.
- This is a genuine visual migration onto the `Card` system, not a byte-for-byte spacing preservation. Minor spacing/sizing differences from the old hand-rolled version are expected and correct — behavior (every interaction, every Server Action call, every prop) must be preserved exactly; visual chrome is being intentionally replaced.
- Run `npx tsc --noEmit` (from `web/`) after every task — must be clean before moving to the next task.
- Run `npm test` (from `web/`) after every task — full suite must pass.

---

## File Structure

Modified files:
- `web/src/components/ui/card.tsx` — one-word fix (`font-heading` → `font-display` on `CardTitle`), Task 1
- `web/src/components/admin/product-images.tsx` — full rewrite onto `Card` primitives, Task 1
- `web/src/components/admin/product-inventory.tsx` — full rewrite onto `Card` primitives, Task 1
- `web/src/components/admin/product-reviews.tsx` — full rewrite onto `Card` primitives, Task 1
- `web/src/components/admin/product-restock.tsx` — full rewrite onto `Card` primitives, Task 1
- `web/src/components/admin/product-signals.tsx` — full rewrite onto `Card` primitives, copy fix, Task 1
- `web/src/components/admin/product-editor.tsx` — full rewrite onto `FormSection`/`FormField`, dirty-gating, Task 2
- `web/src/app/(dashboard)/products/[id]/page.tsx` — restructured into `Tabs`, new header, Task 3
- `web/src/app/(dashboard)/products/new/page.tsx` — new header, guard wiring, Task 4

New files:
- `web/src/components/admin/unsaved-changes-guard.tsx` — Task 2
- `web/src/components/admin/product-editor.test.tsx` — Task 2
- `web/src/app/(dashboard)/products/[id]/loading.tsx` — Task 5
- `web/src/app/(dashboard)/products/[id]/error.tsx` — Task 5
- `web/src/app/(dashboard)/products/new/loading.tsx` — Task 5
- `web/src/app/(dashboard)/products/new/error.tsx` — Task 5

Explicitly NOT touched: the Products list page and table (`products/page.tsx`, `products-table.tsx` — already migrated in Wave 1), Inventory (already migrated), any Server Action files under `products/actions.ts` (business logic unchanged), `toggle.tsx`, `chip.tsx`.

---

### Task 1: Migrate the five read/mutate sub-panels onto `Card` primitives

**Files:**
- Modify: `web/src/components/ui/card.tsx`
- Modify: `web/src/components/admin/product-images.tsx`
- Modify: `web/src/components/admin/product-inventory.tsx`
- Modify: `web/src/components/admin/product-reviews.tsx`
- Modify: `web/src/components/admin/product-restock.tsx`
- Modify: `web/src/components/admin/product-signals.tsx`

**Interfaces:**
- Consumes: `Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction` (`@/components/ui/card`, all pre-existing exports except the one font fix below).
- Produces: `ProductImages`, `ProductInventory`, `ProductRestock`, `ProductSignals`, `ProductReviews` — same export names, same prop types (`ProductImage`, `InventoryVariant`, `RestockGroup`, `EngagementRow`/`SimilarProduct`, `ReviewRow`), all unchanged. Task 3 imports these exactly as it does today.

- [ ] **Step 1: Fix `CardTitle`'s font token**

In `web/src/components/ui/card.tsx`, change:
```tsx
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}
```
to:
```tsx
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-display text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}
```
`--font-heading` resolves to `--font-inter` (`web/src/app/globals.css:12`) — the pre-redesign sans font. `--font-display` resolves to `--font-serif` (`globals.css:13`) — the actual redesign token, already used by `PageHeader`'s `<h1>`. Nothing else in this file changes.

- [ ] **Step 2: Rewrite `product-images.tsx`**

Replace the file's `return` statement and outer structure. Every function above the `return` (`run`, `onFile`, `move`, all state, all imports) stays **exactly as it is today** — only add the `Card` import and change the returned JSX:

Add to the top imports:
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
```

Replace the `return (...)` block with:
```tsx
  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="border-b pt-4">
        <CardTitle>Images</CardTitle>
        <CardDescription>The primary image (★) shows in the app catalog. Drag order sets the gallery sequence.</CardDescription>
        <CardAction>
          <label className={cn(
            "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted",
            pending && "pointer-events-none opacity-60"
          )}>
            <UploadSimple weight="duotone" className="size-4" />
            Upload
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onFile} disabled={pending} />
          </label>
        </CardAction>
      </CardHeader>

      <CardContent className="py-4">
        {err ? <p className="mb-3 text-[12px] text-destructive-soft-foreground">{err}</p> : null}
        {images.length === 0 ? (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border py-10 text-center text-[13px] text-muted-foreground transition-colors hover:bg-muted">
            <ImageSquare weight="duotone" className="size-6" />
            No images yet — upload the bottle shot.
            <input type="file" accept="image/*" className="sr-only" onChange={onFile} disabled={pending} />
          </label>
        ) : (
          <div className={cn("flex flex-wrap gap-3", pending && "opacity-60")}>
            {images.map((img, i) => (
              <div key={img.id} className="group relative w-28">
                <div className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="size-full object-cover" />
                  {img.isPrimary ? (
                    <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-primary/90 px-1 py-px text-[10px] font-medium text-primary-foreground">
                      <Star weight="fill" className="size-2.5" /> Primary
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-0.5">
                    <button type="button" disabled={pending || i === 0} onClick={() => move(i, -1)} aria-label="Move left"
                      className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30">
                      <CaretLeft className="size-3.5" />
                    </button>
                    <button type="button" disabled={pending || i === images.length - 1} onClick={() => move(i, 1)} aria-label="Move right"
                      className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30">
                      <CaretRight className="size-3.5" />
                    </button>
                  </span>
                  <span className="flex items-center gap-0.5">
                    {!img.isPrimary ? (
                      <button type="button" disabled={pending} onClick={() => run(() => setPrimaryImage({ imageId: img.id, productId }))} aria-label="Make primary"
                        className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-brand disabled:opacity-30">
                        <Star className="size-3.5" />
                      </button>
                    ) : null}
                    <button type="button" disabled={pending}
                      onClick={() => { if (confirm("Delete this image?")) run(() => deleteProductImage({ imageId: img.id, productId, storagePath: img.storagePath })); }}
                      aria-label="Delete image"
                      className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-30">
                      <Trash className="size-3.5" />
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
```
No hardcoded hex/shadow existed in this file besides the outer wrapper (confirmed: `grep` found only line 46's `rounded-[12px] ... shadow-[...]`), so this step's only correctness requirement is that every button/handler above is untouched and every prop/behavior is identical to before.

- [ ] **Step 3: Rewrite `product-inventory.tsx`**

Add the same `Card` import. `Stat` and `VariantRow` (lines 39-136) stay exactly as they are **except** two token substitutions inside `VariantRow`:
- Line 78: `` className="nums truncate text-[12px] text-[#B5B2AC]" `` → `` className="nums truncate text-[12px] text-muted-foreground" ``
- Line 127: `` className="h-8 shrink-0 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-[#1a1917] disabled:opacity-40" `` → `` className="h-8 shrink-0 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40" ``

Replace only the outer `ProductInventory` function's `return`:
```tsx
export function ProductInventory({ productId, variants }: { productId: string; variants: InventoryVariant[] }) {
  return (
    <Card className="h-fit overflow-hidden p-0">
      <CardHeader className="border-b pt-4">
        <CardTitle>Inventory</CardTitle>
        <CardDescription>Every stock move is logged and attributed. Receiving into an out-of-stock variant notifies waitlisters.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {variants.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">No variants to stock yet.</p>
        ) : (
          variants.map((v) => <VariantRow key={v.variantId} v={v} productId={productId} />)
        )}
      </CardContent>
    </Card>
  );
}
```
`VariantRow` itself keeps its own `border-t border-border px-5 py-4 first:border-t-0` — that self-contained per-row divider styling doesn't change, only the two hex tokens noted above and the outer shell.

- [ ] **Step 4: Rewrite `product-reviews.tsx`**

Add the `Card` import. Two token substitutions inside `Stars` and `ReviewItem` (both unchanged otherwise):
- Line 31: `` <span className="text-[#D6D3CD]">{"★".repeat(...)}</span> `` → `` <span className="text-muted-foreground">{"★".repeat(...)}</span> ``
- Line 77: `` className="h-7 rounded-md bg-primary px-2.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-[#1a1917] disabled:opacity-40" `` → `` className="h-7 rounded-md bg-primary px-2.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40" ``

Replace only the outer `ProductReviews` function's `return`:
```tsx
export function ProductReviews({ productId, reviews }: { productId: string; reviews: ReviewRow[] }) {
  const published = reviews.filter((r) => r.status === "published").length;
  const pending = reviews.filter((r) => r.status === "pending").length;

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="border-b pt-4">
        <CardTitle>Reviews</CardTitle>
        <CardDescription>Only published reviews count toward the product rating.</CardDescription>
        <CardAction>
          <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            {pending ? <Chip tone="warning">{pending} pending</Chip> : null}
            <span className="nums">{published} published</span>
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {reviews.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">No reviews yet.</p>
        ) : (
          reviews.map((r) => <ReviewItem key={r.id} r={r} productId={productId} />)
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Rewrite `product-restock.tsx`**

Add the `Card` import. One token substitution inside the list item (line 30): `` <span className="nums ml-2 text-[12px] text-[#B5B2AC]">{g.sku}</span> `` → `` <span className="nums ml-2 text-[12px] text-muted-foreground">{g.sku}</span> ``

Replace the whole `ProductRestock` function's `return`:
```tsx
export function ProductRestock({ groups }: { groups: RestockGroup[] }) {
  const total = groups.reduce((s, g) => s + g.count, 0);

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="border-b pt-4">
        <CardTitle className="flex items-center gap-1.5">
          <BellRinging weight="duotone" className="size-4 text-brand" />
          Restock waitlist
        </CardTitle>
        <CardDescription>Receiving stock into an out-of-stock variant notifies these customers automatically.</CardDescription>
        <CardAction>
          <span className="nums text-lg font-[650]">{formatInt(total)}</span>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {total === 0 ? (
          <p className="px-5 py-6 text-center text-[13px] text-muted-foreground">No one is waiting on a restock.</p>
        ) : (
          <ul>
            {groups.filter((g) => g.count > 0).map((g) => (
              <li key={g.variantId} className="flex items-center justify-between gap-2 border-t border-border px-5 py-2.5 first:border-t-0">
                <span className="min-w-0">
                  <span className="text-[13px] font-medium">{g.label}</span>
                  <span className="nums ml-2 text-[12px] text-muted-foreground">{g.sku}</span>
                </span>
                <span className="nums text-[13px]">{formatInt(g.count)} waiting</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Rewrite `product-signals.tsx`**

Add the `Card` import. Two token substitutions (both `text-[#B5B2AC]` → `text-muted-foreground`, lines 50 and 73). Also fix the dev-facing copy at line 39, which names an env var directly to the shop owner — the same category of bug Wave 1 fixed on Products/Inventory's swallowed-error strings: `` Engagement is unavailable — set <code className="nums text-[12px]">SUPABASE_SECRET_KEY</code> in <span className="nums">web/.env.local</span> to read the recs pipeline. `` → `` Engagement data isn't available right now. ``

This file has two logical sections in one card (Engagement stats, then a "Customers also see as similar" list) — use `CardHeader` twice, the second with `border-t` instead of `border-b`:
```tsx
export function ProductSignals({
  engagement,
  similar,
  available,
}: {
  engagement: EngagementRow[];
  similar: SimilarProduct[];
  available: boolean;
}) {
  const byType = new Map(engagement.map((e) => [e.event_type, e]));
  const totalEvents = engagement.reduce((s, e) => s + e.events, 0);

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="border-b pt-4">
        <CardTitle>Engagement</CardTitle>
        <CardDescription>How customers interact with this scent in the app. Read-only signal from the recs pipeline.</CardDescription>
      </CardHeader>

      <CardContent className="py-4">
        {!available ? (
          <p className="text-[13px] text-muted-foreground">Engagement data isn&rsquo;t available right now.</p>
        ) : totalEvents === 0 ? (
          <p className="text-[13px] text-muted-foreground">No interactions logged yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {METRICS.map((m) => {
              const row = byType.get(m.key);
              return (
                <div key={m.key}>
                  <div className="nums text-lg font-[650] leading-none">{formatInt(row?.events ?? 0)}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{m.label}</div>
                  {row && row.users > 0 ? <div className="nums text-[11px] text-muted-foreground">{formatInt(row.users)} people</div> : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <CardHeader className="border-t pt-4 pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Sparkle weight="duotone" className="size-4 text-brand" />
          Customers also see as similar
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {similar.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No similar scents yet — this product may still be embedding, or needs a scent family + notes.</p>
        ) : (
          <ul className="space-y-1">
            {similar.map((s, i) => (
              <li key={s.id}>
                <Link href={`/products/${s.id}`} className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-muted">
                  <span className="min-w-0 truncate">
                    <span className="nums mr-2 text-[11px] text-muted-foreground">{i + 1}</span>
                    <span className="font-medium">{s.name}</span> <span className="text-muted-foreground">{s.brand}</span>
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```
The `CardTitle` at the second header uses `className="flex items-center gap-1.5 text-sm"` to size down from `CardTitle`'s default `text-base` — this is a secondary in-card heading, not the card's main title, so it should read smaller; `text-sm` plus `font-medium` (inherited from `CardTitle`'s base class) reads correctly at that weight.

- [ ] **Step 7: Typecheck and run the full suite**

Run: `cd web && npx tsc --noEmit && npm test`
Expected: no type errors; all existing suites still pass (no new tests in this task — these five files had none before and their public props/behavior are unchanged, so nothing new to assert yet; Task 2 adds the plan's only new test file).

- [ ] **Step 8: Manually verify**

Run `npm run dev`, sign in, open any product's detail page. Confirm: all five panels render with square corners and no visible hex-color regressions, Upload/image-reorder/delete still work, a stock Receive/Adjust/Count action still posts and refreshes, a review Publish/Reject still works, the "Customers also see as similar" list still links correctly. This step is necessarily approximate until Task 3 lands the page's new tabbed layout — for now these components render in their current page positions (Task 3 moves them into tabs).

- [ ] **Step 9: Commit**

```bash
git add web/src/components/ui/card.tsx web/src/components/admin/product-images.tsx web/src/components/admin/product-inventory.tsx web/src/components/admin/product-reviews.tsx web/src/components/admin/product-restock.tsx web/src/components/admin/product-signals.tsx
git commit -m "feat(admin): migrate Product detail's 5 read/mutate panels onto Card primitives

ProductImages, ProductInventory, ProductReviews, ProductRestock, and
ProductSignals each hand-rolled the same rounded-[12px]/shadow-[...] card
shell and hardcoded #B5B2AC/#1a1917/#D6D3CD literals — now composed from
Card/CardHeader/CardTitle/CardDescription/CardContent/CardAction, the
first real usage of those primitives anywhere in the codebase. Fixed
CardTitle's font token (font-heading -> font-display) since it had zero
prior consumers and font-heading resolves to the pre-redesign Inter font.
Also softened ProductSignals' dev-facing 'set SUPABASE_SECRET_KEY' string
into shop-owner-appropriate copy. All Server Action calls and interactive
behavior are unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `ProductEditor` — `FormSection`/`FormField`, dirty-state gating, inline errors, unsaved-changes guard

This is the largest, most judgment-heavy task in this plan — recommend a standard-or-higher capability model for the implementer, not the cheapest tier, even though the code below is close to complete: the dirty-tracking and focus-on-error logic require understanding *why*, not just transcribing.

**Files:**
- Create: `web/src/components/admin/unsaved-changes-guard.tsx`
- Modify: `web/src/components/admin/product-editor.tsx` (full rewrite)
- Create: `web/src/components/admin/product-editor.test.tsx`

**Interfaces:**
- Consumes: `FormSection` (`@/components/admin/form-section`, `{title, description?, children}`, auto-wraps children in `grid gap-4 sm:grid-cols-2`), `FormField` (`@/components/admin/form-field`, `{label, htmlFor, optional?, helper?, error?, children}`, single-element `children` only, clones `aria-describedby` onto it when `helper`/`error` is set — the child must carry a matching `id={htmlFor}` itself, `FormField` does not inject one).
- Produces: `useUnsavedChanges()` hook and `UnsavedChangesProvider`/`BlockableLink` components (`@/components/admin/unsaved-changes-guard`) — Tasks 3 and 4 import and wire these around each page's back-link. `ProductEditor({initial, brands, categories})` — same signature as today, same `EditorInitial`/`Ref` types, unchanged.

- [ ] **Step 1: Write the new shared guard file**

Create `web/src/components/admin/unsaved-changes-guard.tsx`. This is a locally-scoped version of the pattern Next.js's own docs recommend for exactly this case (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`, "Blocking navigation") — a small context so a form deep in the tree and a same-page nav link can share "is there unsaved work?" without prop-drilling:

```tsx
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Link, { type LinkProps } from "next/link";

type UnsavedChangesContextValue = {
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue>({
  isDirty: false,
  setIsDirty: () => {},
});

/** Reads the current page's "has unsaved changes?" flag. Safe to call
 * outside a UnsavedChangesProvider — falls back to a permanent `false`. */
export function useUnsavedChanges() {
  return useContext(UnsavedChangesContext);
}

/** Wrap a page's content in this once; a form inside calls
 * `useUnsavedChanges().setIsDirty(...)`, and any BlockableLink in the same
 * subtree (e.g. a "back to list" link) will confirm before leaving. */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);
  return (
    <UnsavedChangesContext.Provider value={{ isDirty, setIsDirty }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

/** A next/link that confirms before leaving if the nearest
 * UnsavedChangesProvider reports unsaved changes. Only covers same-origin
 * client-side navigations (Link's `onNavigate` contract) — browser
 * back/refresh/tab-close are handled separately via `beforeunload`. */
export function BlockableLink(props: LinkProps & { children: ReactNode; className?: string }) {
  const { isDirty } = useUnsavedChanges();
  return (
    <Link
      {...props}
      onNavigate={(e) => {
        if (isDirty && !window.confirm("You have unsaved changes. Leave anyway?")) {
          e.preventDefault();
        }
      }}
    />
  );
}
```

- [ ] **Step 2: Write the failing test**

Create `web/src/components/admin/product-editor.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductEditor, type EditorInitial } from "@/components/admin/product-editor";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/app/(dashboard)/products/actions", () => ({
  saveProduct: vi.fn(async () => ({ ok: true, id: "p1" })),
}));

const BLANK: EditorInitial = {
  id: "p1",
  name: "Midnight Oud",
  brand_id: "b1",
  category_id: null,
  gender: "unisex",
  description: "",
  scent_family: "Woody",
  main_accords: [],
  release_year: null,
  is_active: true,
  is_featured: false,
  notes: [],
  variants: [],
};

const brands = [{ id: "b1", name: "Acme" }];
const categories: { id: string; name: string }[] = [];

describe("ProductEditor", () => {
  it("renders without any hardcoded hex colors", () => {
    const { container } = render(<ProductEditor initial={BLANK} brands={brands} categories={categories} />);
    expect(container.innerHTML).not.toMatch(/\[#[0-9a-fA-F]{3,8}\]/);
  });

  it("disables Save until the form is actually edited", async () => {
    render(<ProductEditor initial={BLANK} brands={brands} categories={categories} />);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Name"), "!");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("shows an inline error under Scent family when it's cleared, without a global banner", async () => {
    render(<ProductEditor initial={BLANK} brands={brands} categories={categories} />);
    const scentField = screen.getByLabelText("Scent family");
    await userEvent.clear(scentField);
    expect(screen.getByText(/required for this product to be recommended/i)).toBeInTheDocument();
  });

  it("shows a visible label for every field, not placeholder-only", () => {
    render(<ProductEditor initial={BLANK} brands={brands} categories={categories} />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Brand")).toBeInTheDocument();
    expect(screen.getByLabelText("Scent family")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/product-editor.test.tsx`
Expected: FAIL — the component still hand-rolls `Field`/`Section`, has no dirty-gating, and the scent-family warning is a border-color hack rather than a visible error message.

- [ ] **Step 4: Rewrite `product-editor.tsx`**

The pure helpers (`splitList`, `toMinor`, `toMajor`, `notesFor`, lines 45-49 today), the `EditorInitial`/`Ref`/`VariantState` types, the `CONCENTRATIONS`/`GENDERS` constants, and `patchVariant`/`addVariant`/`removeVariant` all stay conceptually the same — reproduced below as part of the full file since enough else changes around them that a diff would be harder to follow than a full replacement:

```tsx
"use client";

import { useId, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Plus, X } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Toggle } from "@/components/admin/toggle";
import { FormSection } from "@/components/admin/form-section";
import { FormField } from "@/components/admin/form-field";
import { useUnsavedChanges } from "@/components/admin/unsaved-changes-guard";
import { saveProduct, type ProductPayload, type NoteInput } from "@/app/(dashboard)/products/actions";

export type EditorInitial = {
  id: string;
  name: string;
  brand_id: string;
  category_id: string | null;
  gender: string;
  description: string;
  scent_family: string;
  main_accords: string[];
  release_year: number | null;
  is_active: boolean;
  is_featured: boolean;
  notes: { name: string; position: "top" | "heart" | "base" }[];
  variants: {
    id: string;
    size_ml: number;
    concentration: string;
    sku: string;
    barcode: string | null;
    price_minor: number;
    compare_at_price_minor: number | null;
    is_active: boolean;
  }[];
};

type Ref = { id: string; name: string };

const CONCENTRATIONS = ["EDC", "EDT", "EDP", "Parfum", "Extrait"];
const GENDERS = ["unisex", "male", "female"];

const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";
const numInput = cn(inputClass, "nums");
const smallInput = cn(inputClass, "h-8 text-[13px]");

const splitList = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);
const toMinor = (major: string) => Math.round(parseFloat(major) * 100);
const toMajor = (minor: number | null) => (minor == null ? "" : (minor / 100).toString());
const notesFor = (notes: EditorInitial["notes"], pos: string) =>
  notes.filter((n) => n.position === pos).map((n) => n.name).join(", ");

type VariantState = EditorInitial["variants"][number] & { _key: string; priceText: string; compareText: string };

/** A compact labeled input for the Variants repeating list. FormField's
 * cloneElement contract expects one field per labeled block with room for
 * a full helper/error line below it — fine for the form above, but each
 * variant here is a whole row of 6 short fields, and FormField's padding
 * would blow up row height 6x per variant. This keeps the same "label
 * always visible above the input" requirement at table-row density. */
function CompactField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

type EditorFields = {
  name: string;
  brandId: string;
  categoryId: string;
  gender: string;
  description: string;
  scentFamily: string;
  accordsText: string;
  releaseYear: string;
  isActive: boolean;
  isFeatured: boolean;
  top: string;
  heart: string;
  base: string;
  variants: VariantState[];
};

/** Normalizes editor state into a string for equality comparison — used
 * to detect whether anything has actually changed since the last save
 * (or since mount), per the spec's dirty-gating requirement. Not the same
 * shape as ProductPayload; this only needs to be internally consistent. */
function snapshot(f: EditorFields): string {
  return JSON.stringify({
    name: f.name.trim(),
    brandId: f.brandId,
    categoryId: f.categoryId || null,
    gender: f.gender,
    description: f.description.trim(),
    scentFamily: f.scentFamily.trim(),
    accords: splitList(f.accordsText),
    releaseYear: f.releaseYear.trim(),
    isActive: f.isActive,
    isFeatured: f.isFeatured,
    top: splitList(f.top),
    heart: splitList(f.heart),
    base: splitList(f.base),
    variants: f.variants.map((v) => ({
      id: v.id,
      size_ml: v.size_ml,
      concentration: v.concentration,
      sku: v.sku.trim(),
      barcode: v.barcode?.trim() || null,
      priceText: v.priceText.trim(),
      compareText: v.compareText.trim(),
      is_active: v.is_active,
    })),
  });
}

export function ProductEditor({ initial, brands, categories }: { initial: EditorInitial; brands: Ref[]; categories: Ref[] }) {
  const router = useRouter();
  const uid = useId();
  const creating = !initial.id;
  const keyer = useRef(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(initial.name);
  const [brandId, setBrandId] = useState(initial.brand_id);
  const [categoryId, setCategoryId] = useState(initial.category_id ?? "");
  const [gender, setGender] = useState(initial.gender);
  const [description, setDescription] = useState(initial.description);
  const [scentFamily, setScentFamily] = useState(initial.scent_family);
  const [accordsText, setAccordsText] = useState(initial.main_accords.join(", "));
  const [releaseYear, setReleaseYear] = useState(initial.release_year?.toString() ?? "");
  const [isActive, setIsActive] = useState(initial.is_active);
  const [isFeatured, setIsFeatured] = useState(initial.is_featured);

  const [top, setTop] = useState(notesFor(initial.notes, "top"));
  const [heart, setHeart] = useState(notesFor(initial.notes, "heart"));
  const [base, setBase] = useState(notesFor(initial.notes, "base"));

  const [variants, setVariants] = useState<VariantState[]>(
    initial.variants.map((v) => ({ ...v, _key: v.id, priceText: toMajor(v.price_minor), compareText: toMajor(v.compare_at_price_minor) }))
  );
  const [variantErrors, setVariantErrors] = useState<Record<string, string>>({});

  const scentFamilyRef = useRef<HTMLInputElement>(null);
  const priceRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const liveFields: EditorFields = { name, brandId, categoryId, gender, description, scentFamily, accordsText, releaseYear, isActive, isFeatured, top, heart, base, variants };
  const baselineSnapshot = useRef(snapshot({
    name: initial.name, brandId: initial.brand_id, categoryId: initial.category_id ?? "", gender: initial.gender,
    description: initial.description, scentFamily: initial.scent_family, accordsText: initial.main_accords.join(", "),
    releaseYear: initial.release_year?.toString() ?? "", isActive: initial.is_active, isFeatured: initial.is_featured,
    top: notesFor(initial.notes, "top"), heart: notesFor(initial.notes, "heart"), base: notesFor(initial.notes, "base"),
    variants: initial.variants.map((v) => ({ ...v, _key: v.id, priceText: toMajor(v.price_minor), compareText: toMajor(v.compare_at_price_minor) })),
  }));
  const isDirty = snapshot(liveFields) !== baselineSnapshot.current;

  const { setIsDirty } = useUnsavedChanges();
  useEffect(() => { setIsDirty(isDirty); }, [isDirty, setIsDirty]);
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const clearSavedFlag = () => { if (saved) setSaved(false); };
  function patchVariant(key: string, patch: Partial<VariantState>) {
    clearSavedFlag();
    setVariants((vs) => vs.map((v) => (v._key === key ? { ...v, ...patch } : v)));
    if (patch.priceText !== undefined) setVariantErrors((e) => { const { [key]: _drop, ...rest } = e; return rest; });
  }
  function addVariant() {
    clearSavedFlag();
    setVariants((vs) => [
      ...vs,
      { _key: `new-${keyer.current++}`, id: "", size_ml: 50, concentration: "EDP", sku: "", barcode: null, price_minor: 0, compare_at_price_minor: null, is_active: true, priceText: "", compareText: "" },
    ]);
  }
  function removeVariant(key: string) {
    clearSavedFlag();
    setVariants((vs) => vs.filter((v) => v._key !== key));
  }

  function save() {
    setError(null);
    setVariantErrors({});
    if (!scentFamily.trim()) {
      setError("Scent family is required — it's the gate that lets this product into recommendations.");
      scentFamilyRef.current?.focus();
      return;
    }
    const notes: NoteInput[] = [
      ...splitList(top).map((n) => ({ name: n, position: "top" as const })),
      ...splitList(heart).map((n) => ({ name: n, position: "heart" as const })),
      ...splitList(base).map((n) => ({ name: n, position: "base" as const })),
    ];
    const badVariant = variants.find((v) => v.priceText.trim() && !Number.isFinite(toMinor(v.priceText)));
    if (badVariant) {
      setVariantErrors({ [badVariant._key]: "Enter a valid price." });
      setError(`Enter a valid price for SKU ${badVariant.sku || "—"}.`);
      priceRefs.current[badVariant._key]?.focus();
      return;
    }
    const payload: ProductPayload = {
      id: initial.id,
      name: name.trim(),
      brand_id: brandId,
      category_id: categoryId || null,
      gender,
      description: description.trim() || null,
      scent_family: scentFamily.trim(),
      main_accords: splitList(accordsText),
      release_year: releaseYear.trim() ? parseInt(releaseYear, 10) : null,
      is_active: isActive,
      is_featured: isFeatured,
      notes,
      variants: variants.map((v) => ({
        id: v.id,
        size_ml: Number(v.size_ml),
        concentration: v.concentration,
        sku: v.sku.trim(),
        barcode: v.barcode?.trim() || null,
        price_minor: toMinor(v.priceText || "0"),
        compare_at_price_minor: v.compareText.trim() ? toMinor(v.compareText) : null,
        is_active: v.is_active,
      })),
    };
    start(async () => {
      const res = await saveProduct(payload);
      if (!res.ok) { setError(res.error); return; }
      if (creating) { router.push(`/products/${res.id}`); return; } // land on the new product to add images/stock
      baselineSnapshot.current = snapshot(liveFields); // this save IS the new baseline — otherwise isDirty flips true again on the next render
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <FormSection title="Details" description="What a customer sees on the product page.">
        <FormField label="Name" htmlFor={`${uid}-name`}>
          <input id={`${uid}-name`} className={inputClass} value={name} onChange={(e) => { setName(e.target.value); clearSavedFlag(); }} placeholder="e.g. Midnight Oud" />
        </FormField>
        <FormField label="Brand" htmlFor={`${uid}-brand`}>
          <select id={`${uid}-brand`} className={inputClass} value={brandId} onChange={(e) => { setBrandId(e.target.value); clearSavedFlag(); }}>
            <option value="" disabled>Select a brand…</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </FormField>
        <FormField label="Category" htmlFor={`${uid}-category`} optional>
          <select id={`${uid}-category`} className={inputClass} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); clearSavedFlag(); }}>
            <option value="">None</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FormField>
        <FormField label="Gender" htmlFor={`${uid}-gender`} optional>
          <select id={`${uid}-gender`} className={inputClass} value={gender} onChange={(e) => { setGender(e.target.value); clearSavedFlag(); }}>
            {GENDERS.map((g) => <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>)}
          </select>
        </FormField>
        <FormField label="Release year" htmlFor={`${uid}-release-year`} optional>
          <input id={`${uid}-release-year`} className={numInput} inputMode="numeric" value={releaseYear} onChange={(e) => { setReleaseYear(e.target.value); clearSavedFlag(); }} placeholder="2021" />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Description" htmlFor={`${uid}-description`} optional helper="Feeds recommendations.">
            <textarea id={`${uid}-description`} rows={3} className={cn(inputClass, "h-auto resize-y py-2")} value={description} onChange={(e) => { setDescription(e.target.value); clearSavedFlag(); }} placeholder="The story a customer reads on the product page." />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Scent profile" description="Drives search filters and the recommendation engine.">
        <FormField
          label="Scent family"
          htmlFor={`${uid}-scent-family`}
          helper={scentFamily.trim() ? "e.g. Woody Spicy" : undefined}
          error={!scentFamily.trim() ? "Required for this product to be recommended." : undefined}
        >
          <input
            ref={scentFamilyRef}
            id={`${uid}-scent-family`}
            className={inputClass}
            value={scentFamily}
            onChange={(e) => { setScentFamily(e.target.value); clearSavedFlag(); }}
            placeholder="Oriental, Woody, Fresh…"
          />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Main accords" htmlFor={`${uid}-accords`} optional helper="Comma-separated, strongest first.">
            <input id={`${uid}-accords`} className={inputClass} value={accordsText} onChange={(e) => { setAccordsText(e.target.value); clearSavedFlag(); }} placeholder="amber, vanilla, oud" />
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <span className="text-xs font-medium text-foreground">Notes <span className="font-normal text-muted-foreground">— comma-separated, new names are added to the catalog automatically</span></span>
          <div className="mt-1.5 grid gap-3 sm:grid-cols-3">
            <CompactField label="Top" htmlFor={`${uid}-note-top`}>
              <input id={`${uid}-note-top`} className={inputClass} value={top} onChange={(e) => { setTop(e.target.value); clearSavedFlag(); }} placeholder="Bergamot, Lemon" />
            </CompactField>
            <CompactField label="Heart" htmlFor={`${uid}-note-heart`}>
              <input id={`${uid}-note-heart`} className={inputClass} value={heart} onChange={(e) => { setHeart(e.target.value); clearSavedFlag(); }} placeholder="Rose, Jasmine" />
            </CompactField>
            <CompactField label="Base" htmlFor={`${uid}-note-base`}>
              <input id={`${uid}-note-base`} className={inputClass} value={base} onChange={(e) => { setBase(e.target.value); clearSavedFlag(); }} placeholder="Musk, Amber" />
            </CompactField>
          </div>
        </div>
      </FormSection>

      <FormSection title="Variants" description="Each variant is a purchasable size/concentration combination.">
        <div className="sm:col-span-2">
          {variants.length === 0 ? (
            <p className="mb-3 text-[13px] text-muted-foreground">No variants yet. Add at least one size to sell this scent.</p>
          ) : (
            <div className="space-y-3">
              {variants.map((v) => (
                <div key={v._key} className="relative rounded-md border border-border p-3">
                  {!v.id ? (
                    <button
                      type="button"
                      onClick={() => removeVariant(v._key)}
                      aria-label="Remove variant"
                      className="absolute right-2 top-2 grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <CompactField label="SKU" htmlFor={`${uid}-variant-${v._key}-sku`}>
                      <input id={`${uid}-variant-${v._key}-sku`} className={smallInput} value={v.sku} onChange={(e) => patchVariant(v._key, { sku: e.target.value })} />
                    </CompactField>
                    <CompactField label="Size (ml)" htmlFor={`${uid}-variant-${v._key}-size`}>
                      <input id={`${uid}-variant-${v._key}-size`} className={cn(smallInput, "nums")} inputMode="numeric" value={v.size_ml} onChange={(e) => patchVariant(v._key, { size_ml: Number(e.target.value) })} />
                    </CompactField>
                    <CompactField label="Concentration" htmlFor={`${uid}-variant-${v._key}-conc`}>
                      <select id={`${uid}-variant-${v._key}-conc`} className={smallInput} value={v.concentration} onChange={(e) => patchVariant(v._key, { concentration: e.target.value })}>
                        {CONCENTRATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </CompactField>
                    <CompactField label="Price (Le)" htmlFor={`${uid}-variant-${v._key}-price`}>
                      <input
                        ref={(el) => { priceRefs.current[v._key] = el; }}
                        id={`${uid}-variant-${v._key}-price`}
                        className={cn(smallInput, "nums", variantErrors[v._key] && "border-destructive")}
                        inputMode="decimal"
                        value={v.priceText}
                        onChange={(e) => patchVariant(v._key, { priceText: e.target.value })}
                        placeholder="0.00"
                      />
                      {variantErrors[v._key] ? <p className="mt-1 text-[11px] text-destructive">{variantErrors[v._key]}</p> : null}
                    </CompactField>
                    <CompactField label="Compare-at (Le)" htmlFor={`${uid}-variant-${v._key}-compare`}>
                      <input id={`${uid}-variant-${v._key}-compare`} className={cn(smallInput, "nums")} inputMode="decimal" value={v.compareText} onChange={(e) => patchVariant(v._key, { compareText: e.target.value })} placeholder="—" />
                    </CompactField>
                    <CompactField label="Barcode" htmlFor={`${uid}-variant-${v._key}-barcode`}>
                      <input id={`${uid}-variant-${v._key}-barcode`} className={smallInput} value={v.barcode ?? ""} onChange={(e) => patchVariant(v._key, { barcode: e.target.value })} />
                    </CompactField>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">{v.id ? "Stock is managed in the Inventory tab →" : "New — bootstraps at 0 stock; receive stock after creating."}</span>
                    <span className="flex items-center gap-2 text-[13px]">
                      <span className="text-muted-foreground">Active</span>
                      <Toggle defaultOn={v.is_active} label={`Variant ${v.sku} active`} onChange={(on) => patchVariant(v._key, { is_active: on })} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={addVariant}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <Plus weight="duotone" className="size-4" /> Add variant
          </button>
        </div>
      </FormSection>

      <FormSection title="Visibility">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-[13px] font-medium">Active</p><p className="text-xs text-muted-foreground">Show this product and its variants in the app.</p></div>
          <Toggle defaultOn={isActive} label="Active" onChange={(v) => { setIsActive(v); clearSavedFlag(); }} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-[13px] font-medium">Featured</p><p className="text-xs text-muted-foreground">Eligible for featured placement on the app home.</p></div>
          <Toggle defaultOn={isFeatured} label="Featured" onChange={(v) => { setIsFeatured(v); clearSavedFlag(); }} />
        </div>
      </FormSection>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <div className="min-w-0 text-[13px]">
          {error ? (
            <span className="text-destructive-soft-foreground">{error}</span>
          ) : saved ? (
            <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle weight="duotone" className="size-4" /> Saved — content changes re-embed within a minute.</span>
          ) : creating ? (
            <span className="text-muted-foreground">New products are embedded for recommendations on creation.</span>
          ) : (
            <span className="text-muted-foreground">Saving content re-embeds the product for recommendations.</span>
          )}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending || !isDirty}
          className="inline-flex h-9 shrink-0 items-center rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground shadow-bevel transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? (creating ? "Creating…" : "Saving…") : creating ? "Create product" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
```

Notes on deliberate deviations from a strict "every field gets a FormField" reading (confirm these read as intentional in review, per this plan's Architecture section):
- **The Notes trio (Top/Heart/Base)** is one compound fieldset with a shared heading, not three separate `FormField`s. Three items in `FormSection`'s implicit 2-column grid would wrap unevenly (2 then 1); they're three facets of one "Notes" concept, so a local `CompactField` (not `FormField`, since these need the standard `inputClass`, not the compact-density styling — but they still get the "visible label above input" treatment, just via the same simple `CompactField` helper as the Variants block, for consistency of the "small label + input" pattern used wherever `FormField`'s full contract doesn't fit) sits inside one full-width (`sm:col-span-2`) block instead.
- **The Variants list** is not `FormField`s at all — it's a repeating list of whole variant records, not a list of individual fields; each variant "row" is wrapped once (`sm:col-span-2`) so it spans the section's full width rather than fighting the 2-column grid, and each variant's own 6 sub-fields use the new local `CompactField` helper (visible label, no full FormField padding/helper-row, since a 6-field-wide repeating row can't afford `FormField`'s taller treatment × 6 × N variants).
- **Active/Featured Toggles** are direct `FormSection` children, not wrapped in `FormField` — `Toggle` (`@/components/admin/toggle.tsx`) doesn't accept an `id` prop (Global Constraints: not modified, it's shared with 12 other files), so `FormField`'s `htmlFor`/`id` pairing can't be wired onto it; the existing `<p>` beside each Toggle already supplies a visible label, unchanged from before.
- **Scent family's error** is no longer a border-color hack (`!scentFamily.trim() && "border-warning"`) — it's now a real `FormField` `error` prop, which the spec's "Inline, field-level errors" requirement asks for directly. This is a genuine behavior upgrade, not a preserved quirk.
- **Save button gating and the post-save baseline reset** (`baselineSnapshot.current = snapshot(liveFields)` right before `setSaved(true)`) is the one non-obvious correctness requirement here: after a successful edit-mode save, `router.refresh()` re-fetches the Server Component's data, but this Client Component's `useState` calls were only seeded from `initial` once at mount — they don't reset on a new `initial` prop. Without updating the baseline here, `isDirty` would read `true` again immediately after a successful save (comparing current values against the *old*, pre-save baseline), incorrectly re-disabling nothing and showing dirty state right after a clean save.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/admin/product-editor.test.tsx`
Expected: PASS, 4/4.

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass (including the 4 new tests).

- [ ] **Step 7: Manually verify**

Run `npm run dev`, open a product's detail page (Task 3 hasn't restructured the page into tabs yet, so `ProductEditor` still renders in its current grid position — that's fine for this step). Confirm: Save is disabled until you type something; clearing Scent family shows an inline red message under that field (not just a border color); typing an invalid variant price shows an inline error under that specific row's Price field and focuses it on Save; a successful save re-enables the disabled state correctly (Save should go back to disabled immediately after a successful save, since nothing is dirty anymore); creating a new product still redirects to its new detail page.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/admin/unsaved-changes-guard.tsx web/src/components/admin/product-editor.tsx web/src/components/admin/product-editor.test.tsx
git commit -m "feat(admin): rework ProductEditor onto FormSection/FormField with dirty-gating and inline errors

Retires the local Field/Section helpers in favor of the shared
FormSection/FormField components. Scent family's old border-color-only
warning is now a real inline FormField error. Save is now disabled until
the form is actually dirty (computed via a normalized snapshot compared
against a baseline that's updated after every successful save), and an
invalid variant price now focuses that row's Price field instead of only
showing a banner. Adds unsaved-changes-guard.tsx (UnsavedChangesProvider /
useUnsavedChanges / BlockableLink) so a same-page 'back' link can confirm
before discarding unsaved work — Tasks 3-4 wire it around each page's
back-link.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Restructure `products/[id]/page.tsx` into tabs

**Files:**
- Modify: `web/src/app/(dashboard)/products/[id]/page.tsx`

**Interfaces:**
- Consumes: `Tabs, TabsList, TabsTrigger, TabsContent` (`@/components/ui/tabs`, unchanged — `Tabs` wraps `@base-ui/react/tabs`), `UnsavedChangesProvider, BlockableLink` (Task 2's new file), every sub-component from Task 1/2 with their existing prop shapes (`ProductEditor`, `ProductInventory`, `ProductSignals`, `ProductReviews`, `ProductRestock`, `ProductImages`).

- [ ] **Step 1: Replace the header and restructure the return block**

This step replaces two things: the imports (lines 1-12), and the final `return (...)` block (currently lines 178-208). Everything in between — the function body from `export default async function ProductDetailPage` through the closing brace before `return` (lines 14-177: both `Promise.all` fetch batches and every derived variable — `initial`, `inventory`, `brands`, `categories`, `images`, `reviews`, `engagement`, `engagementAvailable`, `similar`, `restockGroups`) stays **completely unchanged**.

Update imports — replace:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
```
with:
```tsx
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UnsavedChangesProvider, BlockableLink } from "@/components/admin/unsaved-changes-guard";
```
(`Link` is no longer imported directly — the back-link becomes a `BlockableLink`.)

Replace the `return (...)` block with:
```tsx
  return (
    <UnsavedChangesProvider>
      <div className="px-5 pb-6 pt-2">
        <BlockableLink href="/products" className="inline-flex items-center gap-1.5 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Products
        </BlockableLink>
        <div className="flex flex-wrap items-center gap-2.5 pb-4 pt-1">
          <h1 className="font-display text-xl font-semibold tracking-tight">{initial.name || "Untitled product"}</h1>
          <Chip tone={initial.is_active ? "success" : "neutral"}>{initial.is_active ? "Active" : "Hidden"}</Chip>
          {initial.is_featured ? <Chip tone="info">Featured</Chip> : null}
          {!initial.scent_family ? <Chip tone="warning">Needs a scent family</Chip> : null}
        </div>

        <Tabs defaultValue="details">
          <TabsList variant="line">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="pt-4">
            <ProductEditor initial={initial} brands={brands} categories={categories} />
          </TabsContent>

          <TabsContent value="images" className="pt-4">
            <ProductImages productId={initial.id} images={images} />
          </TabsContent>

          <TabsContent value="inventory" className="pt-4">
            <ProductInventory productId={initial.id} variants={inventory} />
          </TabsContent>

          <TabsContent value="reviews" className="pt-4">
            <ProductReviews productId={initial.id} reviews={reviews} />
          </TabsContent>

          <TabsContent value="insights" className="space-y-4 pt-4">
            <ProductSignals engagement={engagement} similar={similar} available={engagementAvailable} />
            <ProductRestock groups={restockGroups} />
          </TabsContent>
        </Tabs>
      </div>
    </UnsavedChangesProvider>
  );
```

Design notes for the reviewer (deliberate choices, not gaps):
- **Tab set** (Details / Images / Inventory / Reviews / Insights) maps the six sub-panels 1:1 except `ProductSignals` + `ProductRestock`, combined into one "Insights" tab — both are read-only signal panels (engagement stats, similar products, restock waitlist), and five tabs reads better than six for a page this size.
- **`variant="line"`** on `TabsList` (the underline style, not the default filled-pill style) — no other page in this codebase uses `Tabs` yet, so there's no existing convention to match; underline tabs are the more common pattern for primary section navigation on a detail page (vs. the pill style, which reads more like a filter toggle). This is a judgment call, not a spec requirement — flag if you'd prefer the default pill style instead, it's a one-word change (drop `variant="line"`).
- **No URL-persisted active tab.** All six panels' data is fetched eagerly regardless of which tab is active (both `Promise.all` batches run unconditionally, unchanged from before this task), so there's no data-fetching cost to switching tabs — only a rendering cost. Persisting the active tab in the URL would need `searchParams`-driven Server Component re-renders that this page doesn't otherwise need, so it's left as local component state — the active tab resets to "Details" on a fresh page load, which is fine since nothing in the spec asks for deep-linking to a specific tab.
- **Correction (post-implementation, added by the final whole-branch review):** this section originally claimed "`Tabs` already keeps all `TabsContent` mounted." That claim was wrong — `@base-ui/react@1.5.0`'s `TabsPanel` defaults `keepMounted` to `false`, so switching away from a tab unmounts its content. Since `ProductEditor` lives inside `TabsContent value="details"`, this silently discarded unsaved edits on a tab switch; fixed post-review by adding `keepMounted` to the tab panels and a cleanup to `ProductEditor`'s dirty-state effect. Any future work adding `Tabs` around stateful content should pass `keepMounted` explicitly rather than assuming it — verify against the installed `@base-ui/react` version, not this document.
- **Header font**: `font-display` replaces the old `text-xl font-[650] tracking-[-0.2px]` — matching `PageHeader`'s own `<h1>` treatment (`font-display text-xl font-semibold tracking-tight`) even though this page doesn't use `PageHeader` itself. `PageHeader` has no slot for a back-link above the title row, and Orders detail (this codebase's only other page with a back-link + title-row header) was deliberately left with its pre-redesign header in Wave 1 — there's no existing "back-link detail page" header component to reuse verbatim. Bringing just the font treatment in line with `PageHeader` (without adopting the whole component) fixes the same font-inconsistency the Wave 1 final review flagged as a known gap, without inventing a new shared header component for what is, so far, a single call site (Task 4 is the second).

- [ ] **Step 2: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass.

- [ ] **Step 3: Manually verify**

Run `npm run dev`, open a product's detail page. Confirm: five tabs render, "Details" is active by default and shows the editor, clicking each tab shows the right panel, the back-link still navigates to `/products`, and — the one behavior this task adds — if you dirty the Details form and then click the back-link, a confirm dialog appears before leaving; canceling it keeps you on the page.

- [ ] **Step 4: Commit**

```bash
git add "web/src/app/(dashboard)/products/[id]/page.tsx"
git commit -m "feat(admin): split Product detail into tabs (Details/Images/Inventory/Reviews/Insights)

Replaces the six-panel undifferentiated scroll with Tabs, per the spec's
Wave 1 directive. All data-fetching is unchanged — every panel's data is
still fetched eagerly regardless of active tab. The back-link is now a
BlockableLink, wrapped in UnsavedChangesProvider, so leaving with unsaved
editor changes prompts first. Header font brought in line with
PageHeader's font-display treatment.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `products/new/page.tsx` — matching header, unsaved-changes guard

**Files:**
- Modify: `web/src/app/(dashboard)/products/new/page.tsx`

**Interfaces:**
- Consumes: `UnsavedChangesProvider, BlockableLink` (Task 2's file), `ProductEditor` (unchanged signature).

- [ ] **Step 1: Update the header and wrap in the guard**

The data-fetching (`brandsRes`/`categoriesRes`, `brands`/`categories`) is unchanged. Replace the imports and return block:

```tsx
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { ProductEditor, type EditorInitial } from "@/components/admin/product-editor";
import { UnsavedChangesProvider, BlockableLink } from "@/components/admin/unsaved-changes-guard";

export const dynamic = "force-dynamic";

const BLANK: EditorInitial = {
  id: "",
  name: "",
  brand_id: "",
  category_id: null,
  gender: "unisex",
  description: "",
  scent_family: "",
  main_accords: [],
  release_year: null,
  is_active: true,
  is_featured: false,
  notes: [],
  variants: [],
};

export default async function NewProductPage() {
  const db = createServerClient();
  const [brandsRes, categoriesRes] = await Promise.all([
    db.from("brand").select("id, name").is("deleted_at", null).order("name"),
    db.from("category").select("id, name").order("name"),
  ]);
  const brands = (brandsRes.data ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
  const categories = (categoriesRes.data ?? []).map((c) => ({ id: c.id as string, name: c.name as string }));

  return (
    <UnsavedChangesProvider>
      <div className="px-5 pb-6 pt-2">
        <BlockableLink href="/products" className="inline-flex items-center gap-1.5 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Products
        </BlockableLink>
        <div className="pb-4 pt-1">
          <h1 className="font-display text-xl font-semibold tracking-tight">New product</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Give it a scent family and at least one variant — it&rsquo;s recommendation-ready the moment you create it. Add images and receive stock on the next screen.</p>
        </div>
        <div className="max-w-3xl">
          <ProductEditor initial={BLANK} brands={brands} categories={categories} />
        </div>
      </div>
    </UnsavedChangesProvider>
  );
}
```
Only the header's font (`font-display`, matching Task 3's detail-page header) and the `UnsavedChangesProvider`/`BlockableLink` wrapping changed — the data fetching, the `BLANK` constant, and the `<div className="max-w-3xl">` wrapper around `ProductEditor` are all unchanged from today.

- [ ] **Step 2: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass.

- [ ] **Step 3: Manually verify**

Run `npm run dev`, open `/products/new`. Confirm: header renders in the serif font matching the detail page, form still creates a product and redirects on success, and dirtying the form then clicking "Products" prompts a confirm dialog before leaving.

- [ ] **Step 4: Commit**

```bash
git add "web/src/app/(dashboard)/products/new/page.tsx"
git commit -m "feat(admin): match New product's header to Product detail, wire unsaved-changes guard

Same font-display header treatment as the now-tabbed detail page, and the
same BlockableLink + UnsavedChangesProvider wiring so leaving a half-filled
new-product form prompts first.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `loading.tsx` + `error.tsx` for both routes

Deliberately last — see this plan's Architecture section for why (a skeleton written before Tasks 3-4's layout changes would go stale the moment those tasks shipped, exactly as happened to three list pages in Wave 1's final review).

**Files:**
- Create: `web/src/app/(dashboard)/products/[id]/loading.tsx`
- Create: `web/src/app/(dashboard)/products/[id]/error.tsx`
- Create: `web/src/app/(dashboard)/products/new/loading.tsx`
- Create: `web/src/app/(dashboard)/products/new/error.tsx`

**Interfaces:**
- Consumes: `Skeleton` (`@/components/ui/skeleton`), `PageError` (`@/components/admin/page-error`) — both pre-existing, used identically to Wave 1's Task 1.

- [ ] **Step 1: Write the Product detail skeleton, shaped to the final tabbed layout**

Create `web/src/app/(dashboard)/products/[id]/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductDetailLoading() {
  return (
    <div className="px-5 pb-6 pt-2">
      <Skeleton className="h-3.5 w-20" />

      <div className="flex flex-wrap items-center gap-2.5 pb-4 pt-1">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-16" />
      </div>

      <div className="flex gap-4 border-b border-border pb-3">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-14" />
      </div>

      <Skeleton className="mt-4 h-72 w-full rounded-card" />
    </div>
  );
}
```
The tab row is modeled as five short skeleton bars under a divider (matching `TabsList variant="line"`'s underline row) rather than five separate skeleton pill shapes, since the exact tab-strip rendering isn't worth over-fitting — the important shape to get right is the header (back-link + title + chip) and that content sits below a tab strip, not instantly one giant panel.

- [ ] **Step 2: Write the Product detail error boundary**

Create `web/src/app/(dashboard)/products/[id]/error.tsx`:

```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function ProductDetailError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load this product" reset={reset} />;
}
```

- [ ] **Step 3: Write the New product skeleton**

Create `web/src/app/(dashboard)/products/new/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function NewProductLoading() {
  return (
    <div className="px-5 pb-6 pt-2">
      <Skeleton className="h-3.5 w-20" />
      <div className="pb-4 pt-1">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-2 h-3 w-96" />
      </div>
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-48 w-full rounded-card" />
        <Skeleton className="h-32 w-full rounded-card" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the New product error boundary**

Create `web/src/app/(dashboard)/products/new/error.tsx`:

```tsx
"use client";

import { PageError } from "@/components/admin/page-error";

export default function NewProductError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load this page" reset={reset} />;
}
```

- [ ] **Step 5: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass.

- [ ] **Step 6: Manually verify**

Run `npm run dev`, throttle network (DevTools → Slow 3G) or trust the skeleton's shape by eye against the loaded tabbed page — confirm the skeleton's header/tab-row/content proportions roughly match the real layout from Task 3.

- [ ] **Step 7: Commit**

```bash
git add "web/src/app/(dashboard)/products/[id]/loading.tsx" "web/src/app/(dashboard)/products/[id]/error.tsx" "web/src/app/(dashboard)/products/new/loading.tsx" "web/src/app/(dashboard)/products/new/error.tsx"
git commit -m "feat(admin): add loading/error states to Product detail and New product

Authored against the tabbed layout Tasks 3-4 shipped, not the old scroll
layout — sequenced last in this plan specifically to avoid the
skeleton/header mismatch Wave 1's final review found on three list pages.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

(Completed during plan-writing, not left for the executor.)

- **Spec coverage:** The spec's only explicit directive for this page — "Products ... detail (split into tabs instead of one long scroll)" (Rollout waves, Wave 1) — is Task 3. "Forms UX"'s Product-editor-specific requirements (separation of concerns via FormSection, always-visible labels, mark-optional not mark-required, inline field-level errors with focus-jump, one dominant primary action, correct input types, dirty-state awareness with a leave-prompt) are all in Task 2, each named explicitly in that task's deviation notes rather than silently assumed. The acceptance criterion's hex/shadow grep is Task 1 (the five panels) + Task 2 (the editor's own two hex/shadow hits).
- **Placeholder scan:** none found — every task gives literal target code; the two places this plan intentionally trades literal-per-item code for a table-like pattern (Task 1's five near-identical Card migrations, each still fully spelled out per file; Task 2's per-field FormField mapping, each field still individually written out) are spelled out per instance, not described abstractly.
- **Type consistency:** `EditorInitial`, `Ref`, `VariantState`, `ProductImage`, `InventoryVariant`, `ReviewRow`, `EngagementRow`/`SimilarProduct`, `RestockGroup` are all defined once (in their respective existing files) and referenced identically across tasks — none of them change shape in this plan, only the components that render around them.
- **Scope:** Confirmed out of scope and untouched: Products list/Inventory (already migrated in Wave 1), the unbounded-query concern research surfaced in `products/[id]/page.tsx` (spans the whole app, not this page specifically — a cross-cutting performance concern for a future dedicated pass, not this plan), `chip.tsx`'s `rounded-sm` vs. spec's "pill badge" wording (pre-existing, Wave-0-era, not touched by any task here), `toggle.tsx` (explicitly not modified, Global Constraints).

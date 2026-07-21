# Web admin — consistency & depth pass

**Date:** 2026-07-10
**Scope:** `web/` (Borteh admin dashboard)
**Status:** design approved, pending implementation plan

## Problem

The admin has 27 pages built across several sessions. Each works, but the design
system described in `web/DESIGN.md` was never actually adopted, and the data
layer assumes a shop with almost no history. Three concrete failures:

1. **No loading or error states exist.** Zero `loading.tsx`, zero `error.tsx`,
   zero `Suspense` anywhere under `web/src/app`. Every page is
   `export const dynamic = "force-dynamic"` and blocks on Supabase before it
   renders. A slow query shows a frozen screen; a failed one falls through to
   Next's default error page.

2. **Queries are unbounded.** Of 111 `.from()` calls under `web/src/app`, four
   use `.limit()` or `.range()`. `app/(dashboard)/page.tsx` selects every row of
   `order`, `order_item`, and `inventory_item`, then aggregates in JavaScript.
   `app/(dashboard)/orders/page.tsx` selects the whole `order` table and derives
   its six summary stats by filtering that array. Both stop working as the shop
   accumulates orders.

3. **The design system is not adopted.** `components/ui/card.tsx` exports a full
   `Card` family and is imported by no file. Instead, 13 files hand-roll
   `const card = "rounded-[12px] border border-border …"`, contributing 32
   hardcoded `rounded-[…]` / `shadow-[…]` one-offs.

   Important: the 12px card radius and the button bevel
   (`inset_0_1px_0_rgba(255,255,255,.14)…`, 5 occurrences) are **intentional,
   owner-supplied "Borteh Admin v5" design decisions**, not accidents. They are
   not to be deleted. The defect is that each is redefined per file rather than
   living in one place.

4. **Dark mode is an abandoned theme that users can still reach.** The `.dark`
   block in `globals.css` is entirely hue 265–270 — `--primary:
   oklch(0.62 0.17 270)` is indigo, the surfaces are cool slate. It is the
   pre-v5 design, orphaned when v5 landed. `ThemeToggle` remains mounted at
   `(dashboard)/layout.tsx:51`, so the owner can click it and land in a generic
   indigo SaaS panel — the first entry on `PRODUCT.md`'s anti-references list.

Two smaller defects found while surveying, both on the Orders page:

- `orders/page.tsx:96` links the primary "New order" button to `/orders/new`,
  which does not exist. The most prominent action on the page 404s.
- `orders/page.tsx:88` renders, on query failure, the subtitle *"Couldn't load
  orders — check the Supabase keys in web/.env.local."* This is shown to the
  shop owner. It is the closest thing the app currently has to an error state.

And one found while writing the implementation plan, which is the most serious
defect in the survey:

- **The Orders summary counts statuses that cannot exist.** The `check`
  constraint at `supabase/migrations/20260616090002_schema.sql:323` permits
  exactly seven values — `pending_payment`, `confirmed`, `preparing`,
  `out_for_delivery`, `delivered`, `cancelled`, `returned` — and no later
  migration widens it. But `orders/page.tsx:12` filters on
  `PENDING = {"pending", "cod_pending"}`. Neither is legal. **The "pending"
  stat has read 0 since it shipped**, and orders awaiting payment are counted
  in no bucket at all. `packing`, `ready`, `dispatched`, and `completed` are
  likewise dead strings, though their buckets survive via legal siblings.
  Moving these aggregates into SQL fixes this as a side effect — the views
  must use the constraint's vocabulary, not the pages'.

### Documentation drift

`web/DESIGN.md` claims Hanken Grotesk + Bricolage Grotesque; `app/layout.tsx`
loads Inter. `web/PRODUCT.md` claims "a considered rose-and-gold palette";
`globals.css` is labelled *"Borteh Admin v5 — warm paper neutrals, bronze
accent"* with `--brand: #8a5327`.

**Resolution: the code is the source of truth.** The docs get corrected to
describe Inter and bronze. We are not changing the visual direction.

## Non-goals

- No new visual direction. Palette, typography, sidebar/topbar shell, ⌘K
  command menu, and route structure all stay.
- No navigation or IA rework.
- No new features.
- No refactoring unrelated to the three failures above.

## Approach

Vertical slice first. Build the foundation, prove it end-to-end on one path,
get sign-off, then apply the locked system to the remaining pages. The failure
mode of this work is producing 27 consistent versions of the wrong thing; this
sequence surfaces that on the third screen rather than the twenty-seventh.

Prerequisite: commit the in-flight combos / POS / storefront work first, then
branch. A 27-page visual diff tangled with feature work is not reviewable.

### Phase 1 — Foundation

**Queries.** A SQL view supplying the Overview's aggregates (revenue, order
counts by status, low-stock count) so the page reads one bounded row instead of
three whole tables. A second view for the Orders summary strip. `.range()`-based
server pagination behind the four list tables (orders, products, inventory,
customers). New migrations follow the hard rule in the root `CLAUDE.md`: name
with `$(date -u +%Y%m%d%H%M%S)`, check `ls supabase/migrations | tail` first.

**Primitives.** Adopt the existing `components/ui/card.tsx` across the 13 files
that hand-roll card chrome; delete the string constants. Add `loading.tsx` per
route segment, using `Skeleton` (which exists at `components/ui/skeleton.tsx`
and is currently imported by nothing) shaped to each page's real layout — not a
generic spinner. Add `error.tsx` per route segment: plain-language message plus
a retry button, never a developer-facing string.

**Tokens.** Promote the v5 decisions instead of deleting them: add a
`--radius-card` token (12px) consumed by `<Card>`, and express the button bevel
as a `<Button>` variant. The pixels do not change; the definitions collapse from
thirteen files to one. Control radius stays `0.375rem` as `globals.css` already
has it; `DESIGN.md`'s claim of `0.5rem` is corrected. The
`rounded-[calc(var(--radius)-3px)]` forms inside `components/ui/` are
token-derived, shadcn-generated, and stay.

Replace hand-rolled `<Link>`-as-button instances with `<Button>`. Rewrite
`DESIGN.md` and the palette paragraph of `PRODUCT.md` to match the code.

**Theme.** v5 is light-only. Delete the orphaned `.dark` block and remove
`ThemeToggle` from `(dashboard)/layout.tsx`. Keep the `next-themes` dependency
so dark can be reintroduced later as deliberate design work.

### Phase 2 — Vertical slice

Overview → Orders list → Order detail. This is the path the owner walks every
shift, and it exercises every primitive above.

**Overview** (`app/(dashboard)/page.tsx`) reads the aggregate view. Hierarchy:
today's revenue as the single headline number, 7-day trend beneath it, then the
order queue and low-stock as supporting panels. Explicitly *not* five co-equal
stat cards — `PRODUCT.md` lists "the hero-metric template: a wall of big-number
stat cards" as an anti-reference.

**Orders list** (`app/(dashboard)/orders/page.tsx`) gets server-side pagination,
summary stats from SQL, `<Button>` for its actions, and the dead `/orders/new`
link **removed** — POS already records counter sales, so the route has no reason
to exist.

**Order detail** (`app/(dashboard)/orders/[id]/page.tsx`) gets the
header-with-key-facts-and-primary-action pattern, so advancing status is one
unambiguous click.

All three get `loading.tsx` and `error.tsx`.

**Gate:** the slice is reviewed and approved before Phase 3 begins.

### Phase 3 — Extension

Apply the locked system to the remaining 24 pages. They reduce to four
archetypes — list, detail, form, settings — so the work compounds. Per page:
adopt `<Card>`, bound the query, add `loading.tsx` + `error.tsx`, swap
hand-rolled buttons.

### Phase 4 — Cross-cutting

Contrast audit on the one remaining (light) theme: body ≥4.5:1, UI text ≥3:1.
Visible focus ring on every interactive element. Empty states upgraded from bare
table rows to a short line plus the obvious first action — the existing copy
("No combos yet. Pair two fragrances to create your first.") is already the right
voice and should be preserved.

## Acceptance criteria

Behavioral, verified by exercising the app — not by inspecting the diff:

- Seed ~3,000 orders. Overview and Orders both load.
- Break the Supabase connection. Every page shows a human error state with a
  retry affordance. No page shows a stack trace, a blank screen, or the word
  "Supabase".
- Every page shows a skeleton while loading, shaped like its content.
- Tab through each screen: focus is always visible.
- The light theme passes AA on body and UI text. No theme toggle ships, and
  `grep -rn "\.dark" web/src/app/globals.css` returns nothing.
- Cards still render at 12px radius and buttons still carry the v5 bevel —
  verified visually, not just by grep. The pass must be pixel-neutral here.
- `grep -rn "rounded-\[\|shadow-\[" web/src/app web/src/components/admin` returns
  nothing. (`web/src/components/ui` is exempt: its `rounded-[calc(var(--radius)…)]`
  forms derive from the token and are correct.)
- No `<Link>` styled as a button remains.

## Risks

- **Migration collision.** Parallel sessions share the migration namespace and
  have collided four times. Follow the root `CLAUDE.md` rule exactly.
- **Scope creep into a re-skin.** The temptation, once touching 27 pages, is to
  "improve" the visuals. The non-goals list is the guard.
- **Six unpushed migrations** already exist. Reconcile with `supabase migration
  list` before adding more.

## Open questions

None blocking. Mobbin MCP is authenticated but gated behind a paid plan; if it
becomes available it would inform table density and the Overview hierarchy, but
the pass does not depend on it.

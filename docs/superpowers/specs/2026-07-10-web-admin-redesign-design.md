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
   hardcoded `rounded-[…]` / `shadow-[…]` one-offs. Radius disagrees three ways:
   `DESIGN.md` says `0.5rem`, `globals.css` says `0.375rem`, the pages hardcode
   `12px`.

Two smaller defects found while surveying, both on the Orders page:

- `orders/page.tsx:96` links the primary "New order" button to `/orders/new`,
  which does not exist. The most prominent action on the page 404s.
- `orders/page.tsx:88` renders, on query failure, the subtitle *"Couldn't load
  orders — check the Supabase keys in web/.env.local."* This is shown to the
  shop owner. It is the closest thing the app currently has to an error state.

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

**Tokens.** Radius settles at `0.375rem` — the value already in `globals.css`,
since code is the source of truth. `DESIGN.md`'s claim of `0.5rem` is corrected.
Remove the hardcoded radius/shadow literals in `app/` and `components/admin/`
(the `rounded-[calc(var(--radius)-3px)]` forms inside `components/ui/` are
token-derived, shadcn-generated, and stay). Replace hand-rolled
`<Link>`-as-button instances with `<Button>`. Rewrite `DESIGN.md` and the
palette paragraph of `PRODUCT.md` to match the code.

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

Dark-mode audit: confirm AA contrast in both themes (body ≥4.5:1, UI ≥3:1).
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
- Light and dark both pass AA on body and UI text.
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

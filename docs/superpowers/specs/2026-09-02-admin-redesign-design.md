# Web admin — brand-aligned redesign

**Date:** 2026-09-02
**Scope:** `web/` (Borteh admin dashboard, ~20 routes under `(dashboard)`)
**Status:** design approved, pending implementation plan
**Supersedes:** `2026-07-10-web-admin-redesign-design.md` (see "Relationship to the July spec" below)

## Problem

The admin works, but reads as inconsistent and hard to use, and doesn't feel
like the same product as the mobile app. A survey of the current code found:

1. **Two competing page-header systems.** A bordered `PageHeader` component
   (used on 9 pages) and a hand-rolled pattern with different padding, weight,
   and letter-spacing (used on 7 pages). Navigating between them produces a
   visible layout/typography jump.
2. **The shared `Card` component is barely used.** Most pages hand-roll an
   identical-looking card via a copy-pasted string constant
   (`const card = "rounded-[12px] border border-border bg-card shadow-[...]"`)
   instead of `components/ui/card.tsx` — duplicated in 6+ files.
3. **~15 files bypass the design-token system** with hardcoded hex colors
   (`text-[#B5B2AC]`, `hover:bg-[#1a1917]`) and a duplicated shadow expression,
   instead of the semantic tokens that already exist for this purpose.
4. **Two different list-loading strategies.** Orders paginates server-side;
   Products and Customers load every row and filter client-side.
5. **No breadcrumbs anywhere**, despite fairly deep routes.
6. **Decorative UI implying features that don't exist:** Dispatch links to a
   `/dispatch/riders` page that 404s, with rider avatars hardcoded to `null`;
   Settings → Staff says "coming soon" for its one purpose; sidebar badge
   counts (`Orders: 6`, `Inventory: 4`) are hardcoded literals, not live data;
   the notification bell has no backing data model at all.
7. **The Products detail page** stacks six sub-panels (editor, inventory,
   reviews, signals, restock, images) into an undifferentiated scroll with no
   in-page navigation — the busiest CRUD screen in the app is also the
   hardest to use.
8. **Analytics' charts are bespoke, low-quality markup** — the dashboard
   revenue chart and Analytics' revenue/payment-mix/funnel/best-sellers charts
   should be real chart components, not hand-rolled SVG/div approximations.

Separately, a prior (partially implemented) spec found real correctness bugs
still present today — see "Relationship to the July spec."

## Decisions (from stakeholder discussion)

- **Scope:** systematic pass across every admin page, not just high-traffic ones.
- **Visual direction:** align with the mobile app's identity — same bronze
  accent, Instrument Serif for headings, paper/ink neutrals — so storefront
  and admin read as one product.
- **Corner radius:** full square (radius 0) everywhere except avatars, status
  dots, and pill badges, matching mobile's "Maison" identity exactly.
- **Functional gaps:** wire up real, live data (sidebar badge counts) and
  remove decorative elements with no backing data (notification bell,
  Dispatch's broken rider UI). Do **not** build the missing features
  themselves (rider assignment, staff invites) — that's separate, future scope.
- **Charts:** replace all bespoke chart markup with shadcn's `chart.tsx`
  (Recharts wrapper) primitives, token-driven colors.
- **Rollout:** foundation wave first (tokens + shared components, proven on
  2 pages), then three grouped waves for the rest.

## Non-goals

- No new features (rider assignment, staff invite flow, real notification
  system). Flagged as separate future work.
- No navigation/IA restructuring — sidebar groups and route structure stay.
- No auth/role model changes — `owner` vs `staff` continue to share one
  permission tier, as they do today.
- No changes to Server Actions' business logic, Supabase query semantics
  (beyond bounding them), or the `requireStaff()` auth boundary.

## Design tokens

- Set `--brand` to mobile's exact bronze (`#8A5327` light / `#C08A4E` dark)
  and align `--background`/`--foreground`/`--border` with mobile's
  `paper`/`ink`/`line` values, so both apps draw from the same palette values,
  not just visually similar ones.
- Add Instrument Serif (`next/font/google`, already used on the public
  `/privacy` and `/data-deletion` pages) as the heading/display font. Keep the
  existing sans (Inter) for table data, form inputs, and body text — serif
  headings over sans data, matching mobile's own pairing.
- Collapse the radius scale to `0` across cards, buttons, inputs, and tables.
  Keep full-round (`999px`) only for avatars, status dots, and pill badges.
- Sweep every hardcoded hex color and duplicated shadow string to reference
  tokens (`grep -rn "text-\[#\|bg-\[#\|shadow-\[" web/src` must return nothing
  outside `components/ui`'s token-derived forms).

### Dark mode — rebuilt, not deleted

The current `.dark` block in `globals.css` is an orphaned pre-v5 theme (hue
~265-270, indigo) that doesn't match the light theme's bronze/paper identity
at all, and the July spec flagged it for deletion since nobody had done the
work to fix it properly. That work is this pass: dark mode gets rebuilt using
mobile's actual dark tokens (`paper`/`ink` inverted, `accent: #C08A4E`), the
same way mobile's own dark mode was designed. `ThemeToggle` stays mounted
(removing it was only ever a stopgap for the broken indigo version).

## Shared component layer

A small set of components every page must use, not just could use:

- **`PageHeader`** — consolidates the two existing header patterns into one
  (title, description, optional primary action). Delete the hand-rolled
  variant; every page adopts this one.
- **`Card`** — enforce `components/ui/card.tsx` everywhere; delete the
  copy-pasted `const card = "..."` string duplicated across 6+ files.
- **`StatCard`** — new. One component for the stat-strip pattern (revenue,
  order counts, etc.), replacing hand-rolled per-page versions with
  inconsistent hex colors.
- **`DataTable`** — a shared wrapper around the existing shadcn `Table`
  primitive: consistent header style, row hover, empty state, and **real
  server-side pagination** (bringing Products and Customers in line with
  Orders, and bounding the Supabase queries behind all four list pages).
- **`EmptyState`** — one component for "nothing here yet" / "not available
  yet" states (replacing ad hoc per-page text, including Settings → Staff's
  "coming soon" line and Dispatch's removed rider UI).
- **Chart primitives** — shadcn's `chart.tsx` (`ChartContainer`,
  `ChartTooltip`, `ChartLegend`, Recharts-based) with a token-driven color
  config. Used for the dashboard revenue chart and all of Analytics (revenue
  trend, payment mix, funnel, best-sellers) — replacing the current bespoke
  chart markup entirely.
- **`StatusPill`** — one component for order/payment/stock status badges,
  replacing scattered inline-styled spans.
- **`loading.tsx` / `error.tsx` per route segment** — not a new "component"
  per se, but a required pairing for every page: a `Skeleton`-based loading
  state shaped to the page's real layout (not a generic spinner), and a
  plain-language error state with a retry affordance (never a developer-facing
  string or a blank screen).

## Functional fixes in scope (live data only)

- **Sidebar badges** (`nav.ts`'s hardcoded `badge: 6` / `badge: 4`) →
  computed server-side in the dashboard layout from real queries (e.g.
  action-needed order count, low-stock item count).
- **Dispatch's rider assignment UI** → remove the dead `/dispatch/riders` link
  and the `rider: null` hardcoded avatar UI. Replace with an honest
  `EmptyState` ("Rider assignment isn't set up yet") rather than a broken
  promise. Building the actual feature is separate future scope.
- **Settings → Staff invite** → same call: restyle the existing "coming soon"
  state as a proper `EmptyState`, don't build the invite flow.
- **Notification bell** → removed entirely. No staff-notification data model
  exists anywhere in the backend (the `notification` table is customer-facing
  order updates, not a staff concept), so there's nothing real to wire it to,
  and building one would be new scope. A decorative fake indicator is worse
  than no indicator.

## Relationship to the July spec (`2026-07-10-web-admin-redesign-design.md`)

That spec explicitly scoped out a new visual direction ("Non-goals: no new
visual direction... we are not changing the visual direction") and focused
on loading/error states, bounded queries, and consolidating the *existing*
v5 design system. It was approved but only partially implemented. Verified
against the current codebase on 2026-09-02:

**Done:** SQL-backed stats for the Orders page (the broken
`pending`/`cod_pending` status-matching bug — filtering on values that don't
exist in the `order.status` check constraint — is gone), `loading.tsx` /
`error.tsx` for the dashboard root and Orders list, the dead `/orders/new`
link is gone.

**Still broken, rolled into this spec's scope:**
- Dark mode is still the orphaned indigo theme it flagged for removal — see
  "Dark mode — rebuilt, not deleted" above.
- Order detail (`orders/[id]`) has no `loading.tsx` / `error.tsx`.
- Only 5 of ~121 Supabase query call sites are bounded (`.limit()`/`.range()`)
  — most list pages still fetch entire tables. Bounding these is now part of
  every list page's `DataTable` migration, wave by wave, not a separate pass.
- Contrast (body ≥4.5:1, UI text ≥3:1) and visible-focus-ring requirements
  carry forward as acceptance criteria for this pass.

This spec supersedes the July one for visual direction; its still-valid,
unimplemented findings are absorbed above rather than tracked separately.

## Rollout waves

- **Wave 0 — Foundation.** Design tokens (bronze/paper/serif/square,
  rebuilt dark mode), the 7 shared components above (including chart
  primitives), `loading.tsx`/`error.tsx` pattern established. Proven live on
  Dashboard + Orders list before touching anything else.
- **Wave 1 — Core operations.** Orders detail (incl. its own loading/error),
  Products list + detail (split into tabs instead of one long scroll),
  Inventory.
- **Wave 2 — Floor operations.** Dispatch (dead rider UI removed), POS,
  Customers + detail.
- **Wave 3 — Long tail.** Collections, Combos, Brands, Storefront, Content
  (onboarding/copy CMS), Analytics (new charts), Settings + all sub-pages.

## Verification

Per wave, per page:

- `tsc --noEmit` and `next build` after each page migrates — no silent
  breakage.
- A real look at each changed page in the browser (dev server + screenshots),
  not just "it compiles."
- Server Actions, Supabase query *semantics* (beyond bounding them), and the
  `requireStaff()` auth boundary stay behaviorally unchanged — this is a
  presentation-layer migration, not a data-layer rewrite.

Acceptance criteria (carried forward from the July spec, still applicable):

- Seed a large order/product volume; every migrated list page still loads
  promptly (queries are bounded, not scanning full tables).
- Break the Supabase connection: every page shows a human error state with a
  retry affordance — no stack trace, blank screen, or the word "Supabase".
- Every page shows a shaped skeleton while loading.
- Tab through each screen: focus is always visible.
- Both light and dark themes pass AA contrast on body and UI text.
- `grep -rn "rounded-\[\|shadow-\[\|text-\[#\|bg-\[#" web/src/app web/src/components/admin`
  returns nothing (`components/ui`'s token-derived `rounded-[calc(var(--radius)...)]`
  forms are exempt).
- No page links to a route that 404s.

## Risks

- **Migration collision on Supabase migrations.** If any wave needs a new
  migration (e.g. a view for bounded aggregates), follow the root
  `CLAUDE.md` hard rule exactly — real UTC timestamp, verified against
  `ls supabase/migrations | tail` immediately before creating the file.
- **Scope creep into new features.** The temptation, once touching every
  page, is to build the things the redesign exposes as missing (rider
  assignment, staff invites, real notifications). The functional-fixes
  section above is the guard — data wiring only, no new features.
- **Four-wave sequence spans a long working session.** Each wave should be
  independently reviewable/shippable rather than treated as one unbroken
  effort, per the rollout section.

## Open questions

None blocking.

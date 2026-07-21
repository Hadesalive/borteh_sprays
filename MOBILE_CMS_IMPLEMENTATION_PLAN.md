# Prompt — Build the Borteh mobile app-wide CMS

> Hand this whole file to a fresh agent (or say: "Read `MOBILE_CMS_IMPLEMENTATION_PLAN.md` and implement it").
> It is written as your kickoff brief. Follow it top to bottom.

## Your mission

Make **every content-bearing surface of the Borteh mobile app editable from the web admin** — copy,
images, curated lists, section titles, onboarding, empty-state text, promos — so the owner can change
what the app says and shows **without a code change or a developer**. The app reads this content live
(online-first, with bundled fallbacks) and the admin edits it behind a staff login.

This is a large, multi-phase track. Do NOT try to one-shot it. Produce a content register + design
first, get the owner's OK, then build in phases, each verified.

---

## Step 0 — Read before you touch anything

- **`CLAUDE.md`** (repo root) — the migration-naming HARD RULE. Multiple Claude sessions share this
  repo and the `supabase/migrations/` global namespace; collisions have broken `db push` repeatedly.
  Name every migration `supabase/migrations/$(date -u +%Y%m%d%H%M%S)_name.sql` and run
  `ls supabase/migrations | tail` **immediately before** creating each file to confirm it sorts last.
- **`mobile/DESIGN.md`** — the "Maison" design language. Content becomes data; **presentation does not
  change**. Don't regress the look. (Cards round + carry a whisper shadow; ProductCard uses a petal on
  the Shop grid — leave that.)
- **`web/AGENTS.md`** — "This is NOT the Next.js you know." Read the relevant guide in
  `web/node_modules/next/dist/docs/` before writing web code. Next 16 + Tailwind v4 + shadcn on Base UI.
- Existing code to reuse (this is the pattern — extend, don't reinvent):
  - `web/src/app/(dashboard)/storefront/` (the storefront builder) + `storefront/actions.ts`
  - `web/src/app/(dashboard)/brands/` & `collections/` + their `actions.ts` (server actions pattern)
  - `web/src/lib/supabase/server.ts` (`createServerClient` read / `createAdminClient` write) and
    `web/src/lib/supabase/storage.ts`
  - Mobile: `mobile/lib/api.ts` (`useHomeCarousel`, `useFeaturedCollections`, `useScentFamilies`,
    `useBrands`), `mobile/lib/tips.ts` (`useTips`) + `mobile/app/tips.tsx`, and the `public.tip`
    migration `supabase/migrations/20260707091606_tips.sql` — **`tip` is the reference implementation
    for a new CMS-managed surface; copy its shape.**
  - RLS + trigger reference: `supabase/migrations/20260620090007_home_carousel.sql`
    (`public.is_staff()` write policy, `public.set_updated_at()` trigger, public read of active rows).

## Ground truth — already done, DO NOT redo

- **The home screen is already fully DB + Storage driven** (hero carousel, featured collections,
  brands, shop-by-scent) via `mobile/lib/api.ts` hooks with bundled fallbacks. This track is NOT
  "wire home to the DB." Home's remaining gaps are: editable **section titles** and the leaderboard
  band on/off toggle.
- **Tips / "How to use Borteh"** (`public.tip` + `mobile/app/tips.tsx`) is DB-driven — the template.
- **Storefront builder** exists in the admin (hero slide active-toggle/delete, scent toggles,
  read-only brand/collection chips). Extend it; don't rebuild.
- **Store contact** (WhatsApp number) reads from `store_location.phone`.
- Money/discounts/totals are server-authoritative; notifications are realtime + push. Don't touch.

## Step 1 — HARD PREREQUISITE (do this first, it is a blocker)

**Staff auth gate on the web admin.** Admin writes currently use the Supabase **service secret with
NO login gate** (see the `storefront-merchandising` notes). A CMS massively expands the write surface,
so you MUST land a real **staff/owner login** in front of the admin before shipping any editor.
Gate every dashboard route + every server action on an authenticated `is_staff()`/`owner` user. This
is non-negotiable and comes before any content work.

## Step 2 — The CMS architecture (three layers)

1. **Structured content tables** — ordered lists with images, one table per surface, following the
   `tip` / `home_carousel` shape (id, fields, `image_path`, `sort_order`, `is_active`, timestamps,
   `deleted_at`; RLS: `anon,authenticated` read active rows, `is_staff()` write; `set_updated_at`
   trigger; seeded so the app is full on day one). Add the missing ones (see inventory) and formalize
   the existing ones under one nav.
2. **A generic copy/content store** — for the long tail of one-off editable strings and rich text that
   don't deserve their own table (section titles, empty-state copy, button/marketing microcopy,
   auth-screen copy). Suggested:
   `app_content(key text primary key, kind text, value_text text, value_json jsonb, image_path text,
   updated_at, updated_by)` keyed by a stable `screen.slot` string (e.g. `home.rail.shop_by_note`,
   `shop.empty.title`, `checkout.delivery_note`). Mobile reads it via a single
   `useContent(key, fallback)` hook that returns the DB value **or the bundled fallback** — a missing
   key must NEVER blank or break a screen.
3. **Feature flags / config** — a small settings table (or reuse an existing config row) for toggles:
   leaderboard band on/off, which optional sections render, seasonal switches, etc.

## Step 3 — Content inventory (audit → register → build)

**First deliverable: a content register.** Sweep `mobile/app/**` and `mobile/components/**` and list
**every** editable string / image / curated list, each assigned a stable key or a table. Known hotspots
found so far (not exhaustive — you must complete the audit):

| Surface | Hardcoded content today | Target |
|---|---|---|
| Onboarding (`app/onboarding.tsx`) | 3 `SLIDES` (title/body/image) | new `onboarding_slide` table |
| Search (`app/search.tsx`) | `POPULAR` chips array | new `popular_search` table (or `app_content`) |
| Home (`app/(tabs)/index.tsx`) | section titles ("Shop by note", "Collections", "Perfect pairs"), greeting; rails already DB | `app_content` keys + a section toggle |
| Shop (`app/(tabs)/shop.tsx`) | gender tab labels, empty-state copy | `app_content` |
| Product (`app/product/[slug].tsx`) | static labels, "Notify me" copy, section headers | `app_content` |
| Cart / Checkout / Order | delivery copy, empty states, order-placed success copy | `app_content` |
| Points / Leaderboard / Invite / Coupons | headings + explainer copy | `app_content` (tips already done) |
| Auth (login/signup/forgot) | screen copy | `app_content` |
| Empty states everywhere | literal titles/bodies | `app_content` |
| Notices/promos | already a broadcast system | ensure editable + image support |
| `components/ScentPicker.tsx` | `SCENTS` / `GENDERS` taste options | table or `app_content` |

Rule: functional identifiers (routes, enum values, prices) are NOT content. Money, stock, and totals
stay server-authoritative — never make those "editable copy."

## Step 4 — Admin UX

- One **"Content" / "App Studio"** nav group in the web admin, grouping every editor (structured tables
  + the `app_content` copy editor + toggles). Match the **Borteh Admin v5** theme (warm paper + bronze
  accent, ink primary, **light-only**; Inter + JetBrains Mono; Phosphor duotone via `/dist/ssr` in
  server components; use `render` not `asChild`) — see the `web-admin-stack` memory.
- Editors should **mirror the mobile screen** they control, with a live-ish preview where feasible.
- **Image upload from the admin UI** (logos/covers/slides/onboarding images). Today images are loaded
  via `scripts/load-home-images.sh` — replace that with real uploads to the `product-images` bucket
  from the editor. This is part of the CMS.

## Step 5 — Mobile integration

- One React Query hook per surface, same idiom as `mobile/lib/api.ts`; `useContent(key, fallback)` for
  the copy store. **Every read has a bundled fallback** — the app is **online-first with light read
  caching, no offline sync** (see the `online-first-no-sync` memory); a slow/absent network must never
  block or blank a screen.
- Presentation is untouched; you are only swapping the source of the strings/images from literals to
  DB-with-fallback.

## Non-negotiable constraints

- **Migrations:** real-timestamp names, check `ls supabase/migrations | tail` right before each write.
  **The OWNER runs `supabase db push` from their own terminal** — you have no DB access. Never apply
  schema via the dashboard or ad-hoc SQL. After creating migrations, tell the owner exactly which files
  to push, and flag any read that will error until the column/table exists (push-before-reload).
- **Parallel sessions** are editing this repo concurrently — expect version collisions; reconcile per
  the root `CLAUDE.md` rule.
- **RLS on every new table:** `anon, authenticated` read active/non-deleted rows; `is_staff()` writes.
- **tsc must pass** in both `mobile/` and `web/` (`npx tsc --noEmit`) before you call anything done.
- **Talk to the owner briefly.** They get stressed by long checklists; once they greenlight a phase,
  build it end-to-end and report concisely. Recommend, don't interrogate.

## Suggested phasing

0. **Staff auth gate** (blocker).
1. **Vertical slice:** `app_content` table + `useContent` hook + wire **one** screen (Onboarding is
   ideal) end-to-end, plus its admin editor. This proves the whole pattern.
2. **Structured tables** for the remaining curated lists (`onboarding_slide`, `popular_search`,
   promo/announcement banners) + editors, following `tip`.
3. **Copy sweep:** move the rest of the screens' strings into `app_content` keys + a copy editor.
4. **Image upload from the admin UI** + **feature-flag toggles**.
5. **Polish:** fallback audit (kill every path that could blank a screen), seed everything so day-one
   is full, update `mobile/DESIGN.md` "Data note" + a short `web/` doc for the CMS, final tsc.

## Definition of done

The owner can change any screen's copy, images, curated lists, section titles, and toggles from the
admin — behind a login — and the app reflects it live with graceful fallbacks, with **zero code
changes**. Both apps typecheck; every new table is RLS'd and seeded; the owner has a clear list of
migrations to push.

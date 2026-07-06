# Borteh Web Admin — Product Management + Inventory (Implementation Plan)

Build a full **product management** area in the web admin (`web/`, Next.js 16) — a products list, add/edit, and a per-product **detail hub** — and fold the remaining **inventory** work into it. The organizing principle: **the most valuable per-product features are the ones that feed the recommendation system.** A product's family/notes/description ARE the embedding inputs; editing them must re-embed; stock levels drive availability + restock.

This plan front-loads a completed audit so you can build without re-discovering. Read it fully, then follow the working protocol at the bottom.

---

## 0. What ALREADY EXISTS — do NOT rebuild

### Web admin stack & conventions (authoritative: `web/DESIGN.md`)
- **Next.js 16** with breaking changes (`web/AGENTS.md`): consult `node_modules/next/dist/docs/` before using an unfamiliar API. Mirror the existing working code as the source of truth.
- shadcn/ui on **Base UI** (`@base-ui/react`): use the **`render` prop, not `asChild`**; `nativeButton={false}` when a `Button` renders a link.
- **Phosphor duotone** icons everywhere. Client comps get `weight` from `IconProvider`; **server components import from `@phosphor-icons/react/dist/ssr` and pass `weight="duotone"`** (avoids the RSC context crash). Ignore `components.json`'s stale `"iconLibrary": "lucide"`.
- Fonts: `Hanken Grotesk` (`--font-sans`, all UI), `Bricolage Grotesque` (`--font-display`, wordmark only), `JetBrains Mono` (`--font-mono`) applied via `.nums` for **all money/stock/counts**. OKLCH tokens in `src/app/globals.css`; ink primary, single brass (`--gold`) accent; no rose/indigo.
- Tables: sticky header, hairline rows, hover, right-aligned mono money, skeletons, teaching empty states. Radius `--radius` 0.5rem.

### Data access & write pattern (the template to copy)
- `web/src/lib/supabase/server.ts`: `createServerClient()` = read (uses secret key so admins see inactive/hidden rows); `createAdminClient()` = **service-role writes**, server-only, bypasses RLS.
- `web/src/lib/supabase/auth-server.ts`: `createAuthServerClient()` = cookie-bound client; use it to read the **current staff id** for ledger attribution (`created_by`).
- **Write pattern:** a `"use server"` `actions.ts` per route → `createAdminClient().rpc(...)` or `.update/.insert/.upsert(...)` → `revalidatePath(...)`; return `{ ok } | { ok:false, error }`. Templates: `orders/actions.ts` (`setOrderStatus`), `pos/actions.ts` (`fn_pos_sale`). **CRUD templates to mirror: `brands/actions.ts`, `collections/actions.ts`.**

### Product & catalog schema (`supabase/migrations/20260616090002_schema.sql` + `20260621090008_product_catalog_fields.sql`)
- `public.product`: id, brand_id (FK, not null), category_id, name, slug, description, gender (male/female/unisex), avg_rating, review_count, popularity_score, is_active, is_featured, deleted_at, **scent_family**, **main_accords text[]**, release_year, search_tsv.
- `public.product_variant`: product_id, size_ml, concentration (EDC/EDT/EDP/Parfum/Extrait), sku, barcode, price_minor, compare_at_price_minor, currency, is_active, deleted_at.
- `public.product_scent_note` (join): (product_id, scent_note_id, position ∈ top/heart/base). `public.scent_note`: id, name (unique), note_family.
- `public.product_image`, `public.brand`, `public.category`.
- Adding a `product_variant` auto-bootstraps `inventory_item` + `availability_signal='out'` (trigger `trg_variant_inventory`).

### Inventory backend — FULLY BUILT (route new writes through these RPCs)
- `inventory_item`: qty_on_hand, qty_reserved, **qty_available = generated (on_hand - reserved)**, reorder_point (default 5), reorder_qty. `stock_ledger`: full audit trail (movement_type, qty_delta, balance_after, reason, created_by, …). `availability_signal`: band ∈ in_stock/low/out.
- **Band rule** = `fn_recompute_band` (out if avail≤0; low if ≤reorder_point; else in_stock). Called by every mutator. **The admin page must READ `availability_signal.band`, not recompute in JS.**
- Stock RPCs (all in `20260616090003_functions_triggers.sql`, all write ledger + recompute band, **all service_role-only**): `fn_receive_stock(variant,qty,actor,reason)`, `fn_adjust_stock(variant,delta,actor,reason)`, `fn_return_stock`, `fn_sell_instore`, `fn_reserve_stock`, `fn_confirm_sale_online`, `fn_release_reservation`, `fn_pos_sale`.
- **NEVER UPDATE `inventory_item` directly** — it bypasses the band recompute, the ledger, and the restock chain.

### Restock out→in chain — FULLY WIRED (do not rebuild)
Stock write → `fn_recompute_band` → `availability_signal.band` UPDATE → `trg_notify_restock` (fires only on out→in) → in-app `notification` → `trg_push_notification` → Expo push. So **receiving/adjusting stock already notifies restock subscribers automatically.** New stock writes just need to go through the RPCs.

### Recs hooks (the ML connections to surface/preserve)
- **Embeddings:** product content (name, brand, family, top/heart/base notes, accords, concentration, description) is the embedding doc. Editing these fields via a normal `product` UPDATE fires `trg_product_embed_upd` (migration `20260706090023`) → GitHub `repository_dispatch` → the embed workflow re-embeds within ~a minute. **Do not bypass a plain product UPDATE for content edits, or auto-re-embed won't fire.**
- **Similar preview:** `public.fn_similar_products(product_id uuid, limit int)` returns ranked neighbour ids — render as "customers see these as similar".
- **Engagement:** `recs.events` (service-role read) has per-product view/dwell/add_to_bag/wishlist/purchase/etc. `recs` schema is UNEXPOSED to PostgREST — read it with a **direct query via an RPC or the service-role admin client against a `public` wrapper**, OR add a small `public.fn_product_engagement(product_id)` SECURITY DEFINER function returning counts. (recs.events is not reachable via PostgREST REST; prefer a wrapper RPC.)
- **Availability:** `availability_signal.band`. **Restock waiters:** `restock_subscription` (status active).

### Current inventory UI & its gaps
- `inventory/page.tsx` (read + summary tiles; **recomputes band in JS — fix to read `availability_signal.band`**), `inventory-table.tsx` (working **Receive** only), `inventory/actions.ts` (`receiveStock` → `fn_receive_stock`, **omits actor**).
- Gaps: no adjust/correction/stocktake UI, no ledger/history UI, no staff attribution, no restock feedback, and **no product management at all** (no `/products` route).

---

## 1. Scope (phased)

### Phase 1 — Core hub (biggest value; subsumes the inventory work)
- **`/products` list** — searchable/filterable table: name, brand, family, from-price, stock band, active. A **"needs attention"** flag for products with no `scent_family` (excluded from recs — the Phase-0 gate, surfaced).
- **`/products/[id]` detail** with:
  - ⭐ **Scent-profile editor** — name, brand, category, gender, description, **scent_family**, **top/heart/base notes**, **main_accords**, release_year, is_active, is_featured. Saved via a transactional RPC (see §2) so notes + product update are atomic; content edits go through a normal product UPDATE so the embed trigger fires.
  - ⭐ **Variants + inventory** — per variant: SKU, size, concentration, price, compare-at, **live band + on-hand + reserved + available**, and inline **Receive / Adjust (±) / Stocktake (set count)** actions with **staff attribution** and a reason.

### Phase 2 — Intelligence & moderation
- ⭐ **Recs & engagement panel (read-only)** — this product's `recs.events` counts (views, dwell, add-to-bag, wishlist, purchases) + **`fn_similar_products` preview**.
- **Reviews** — list + publish/reject inline (see `review` table + existing rollup trigger).
- **Restock subscribers** — count + list for out-of-stock variants.

### Phase 3 — Creation & media
- **Add product** create form (name, brand, description, scent_family, ≥1 variant, notes) → recs-ready from day one. Reuse the Phase-1 editor + save RPC.
- **Images** — set primary, reorder (Supabase Storage `product-images` bucket; see `scripts/load-product-images.mjs` for the path convention).

---

## 2. New DB needed (versioned migrations, service_role-only, verify locally)
- **`fn_stocktake(p_variant uuid, p_count int, p_actor uuid, p_reason text)`** — atomic absolute count: `select ... for update`, `delta = p_count - qty_on_hand`, apply as an `adjustment` ledger row + `fn_recompute_band`. (No "set count" RPC exists today.)
- **`fn_save_product(payload jsonb)`** (recommended) — one transaction: upsert `product` (a plain UPDATE so the embed trigger fires), replace `product_scent_note` rows (resolving/creating `scent_note` by name), upsert `product_variant` rows. Returns the product id. Keeps content edits atomic and trigger-firing. *Alternative:* orchestrate in the Server Action with the service-role client (multiple statements, not atomic) — the RPC is preferred.
- **`fn_product_engagement(p_product_id uuid)`** SECURITY DEFINER — returns per-type event counts from `recs.events` (which is not PostgREST-reachable). Grant to service_role (or authenticated staff-gated).

---

## 3. Engineering standards
- Match `web/DESIGN.md` exactly (Base UI `render`, Phosphor duotone SSR, `.nums` on all numbers, ink/brass, hairline tables). No new hue, no icon-in-tinted-square.
- All stock writes go through the existing/`fn_stocktake` RPCs — **never** a direct `inventory_item` UPDATE.
- **Staff attribution** on every stock write (`createAuthServerClient()` → staff id → `p_actor`); also backfill it into `receiveStock`.
- Fix the inventory page to read `availability_signal.band` (join it) instead of the JS `stockStatus()`.
- Real implementations only; server actions return typed results; `revalidatePath` the touched routes.
- **Preserve the ML invariants:** content edits fire the embed trigger; scent_family is required-not-forbidden; stock writes fire the restock chain; surface (never mutate) `fn_similar_products` + `recs.events`.

## 4. Verification protocol
- Verify migrations locally: `supabase db reset` if Docker is up; else the throwaway-Postgres harness (initdb + stub `set_updated_at`/roles + minimal `public.product`/`inventory_item`/`stock_ledger`/`availability_signal`, apply the new migration, exercise `fn_stocktake`/`fn_save_product`). Remote apply is owner-run `supabase db push`.
- Web: `npx tsc --noEmit` (and/or `next build`/lint) clean.
- End-to-end: run the admin; add a product with a family + notes → confirm a `repository_dispatch` embed run appears in GitHub Actions (content edit re-embeds); edit stock via Adjust/Stocktake → confirm `stock_ledger` rows + correct `availability_signal.band`; render the `fn_similar_products` preview; confirm an out→in receive still fires a restock notification.
- Mark any seed/test data for deletion.

## 5. Working protocol (owner's standard)
Restate the session's scope + "Done when", list the files you intend to create/modify, then **wait for the owner's go before writing code.** One phase per session. Keep changes reviewable; list every touched file. Migrations are versioned SQL in `supabase/migrations/` (latest is `202607...`; check before numbering). Don't touch the recs/mobile work in flight — this is the web-admin track only.

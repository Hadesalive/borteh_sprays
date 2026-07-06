# Borteh — Algorithm-Powered Home, Shop, Search + Combos (Implementation Plan)

Make the storefront feel individually tailored: **no two users see the same home or shop**, natural-language search returns great results, and the merchant can build **combo** and **occasion** collections. This plan front-loads a finished audit + agreed decisions so a fresh session can build without re-deriving.

Read this fully, then follow the working protocol at the bottom. Sibling docs: `RECS_IMPLEMENTATION_PLAN.md` (recs status — Phases 0–4 built) and `PRODUCT_ADMIN_IMPLEMENTATION_PLAN.md` (web product/inventory track).

---

## 0. Guiding decisions (already agreed with the owner)

- **Personalization comes from CONTENT + ORDERING, not layout.** Like Spotify/Netflix: the shelves (header, search, hero slot, rails) are stable in kind and position; *what's on them and their order* is unique per user. Shuffling chrome per user reads as broken. Two users' homes differ because their histories/tastes differ.
- **Defer the gte-small model swap.** Product embeddings stay `all-MiniLM-L6-v2` (used by recs). NL search is a **SQL hybrid** (full-text + attribute + review + taste) — no new model, no edge function, no re-embed. Pure "vibe" semantic search is a later, separate decision (would need query embedding via a Supabase Edge Function + a second gte-small embedding column).
- **Explicit user intent always wins.** Personalization sets the *default* ordering; the moment a user picks a sort or filter (or types a search), that overrides personalization — never trap them.
- **Merchant controls the pool; the algorithm picks the match.** When the admin curates >1 hero slide / collection, the algorithm chooses which to show a given user; with one curated item everyone sees it (that's merchandising).

## 1. What already exists (do NOT rebuild)

**Recs backend (all live/verified — see RECS_IMPLEMENTATION_PLAN.md):** `recs.user_profile` (`taste_embedding vector(384)`, `top_families` jsonb, `brand_affinity` jsonb, `price_min/max_minor`, `event_count`), product embeddings (`public.product.embedding`, MiniLM, HNSW), and public RPCs: `fn_similar_products(id,limit)`, `fn_picked_for_you`, `fn_trending`, `fn_because_you_viewed`, `fn_back_in_stock`, `fn_new_in_family`, `fn_still_thinking`, `fn_cf_picks`, `fn_candidate_features`, `fn_set_scent_prefs`/`fn_get_scent_prefs`, `fn_track_events`. `recs` schema is UNEXPOSED → always add a `public.fn_*` SECURITY DEFINER wrapper for the app.

**Catalog schema:** `public.product` (name, slug, brand_id, category_id, description, gender male/female/unisex, `scent_family`, `main_accords text[]`, `avg_rating`, `review_count`, `popularity_score`, `is_active`, `is_featured`, `deleted_at`, **`search_tsv`** = `to_tsvector('simple', name||' '||description)`), `product_variant` (price_minor, concentration, sku, availability via `availability_signal.band`), `product_scent_note`→`scent_note(name, note_family, position)`, `brand`, **`public.category`** (is `kind` collection|taxonomy, `is_featured_home`, `cover_image_path`, `sort_order`) — **collections are featured categories**; products join via `category_id`.

**Mobile (RN/Expo, Maison — read `mobile/DESIGN.md`):** home `app/(tabs)/index.tsx` (currently an over-immersive hero — TO BE RESTRUCTURED, see §3), shop `app/(tabs)/shop.tsx` + `lib/search.ts` (client filter/sort + recent searches; NOT personalized), `lib/feed.ts` `useHomeFeed()` (composes the personalized rails), `components/FeedRail.tsx`, `ProductCard.tsx`, `ScentPicker.tsx`, `lib/recentlyViewed.ts` (local slugs), `lib/track.ts`. `fetchFeaturedCollections` in `lib/api.ts` reads `category` where `is_featured_home`.

**Web admin (Next 16, read `web/DESIGN.md`):** POS at `web/src/app/(dashboard)/pos` (+ `fn_pos_sale`), storefront/collections management exists; write pattern = `"use server"` `actions.ts` → `createAdminClient().rpc/update` → `revalidatePath`. Product-admin track building `/products` (see PRODUCT_ADMIN_IMPLEMENTATION_PLAN.md).

## 2. New DB — personalization + hybrid search RPCs (one migration)
All `public`, SECURITY DEFINER, `search_path=public`, granted per note. Verify on a throwaway PG17 with pgvector (`/opt/homebrew/opt/postgresql@17`), stubbing minimal catalog + applying the recs migrations.

- **`fn_my_top_families()` → (family, score)** — the caller's `recs.user_profile.top_families`, ranked. Drives personalized **Shop-by-note** order (anon/cold → admin `sort_order`). Grant authenticated.
- **`fn_rank_collections(p_slugs text[])` → (slug, affinity)** — for the curated featured-collection slugs, avg `1 - (product.embedding <=> taste_embedding)` over each collection's products; order desc. Mobile picks the top-affinity collection for the collection slot. Anon → empty → admin order. Grant authenticated.
- **`fn_shop_ranked(p_limit,p_offset)` → (product_id, score)** — shop "For you / Featured" default sort: `blend.weights.content * taste_sim + trending * norm(popularity_score) + rating_boost(avg_rating,review_count)`, active only. Anon → popularity+rating. Grant anon+authenticated. (App uses it ONLY for the default sort with no filters; explicit sort/filter overrides.)
- **`fn_search_products(p_query text, p_limit)` → (product_id, score)** — **hybrid NL search**: `websearch_to_tsquery('simple', q)` over `search_tsv` (name/desc) **+** attribute matches (scent_family, `main_accords`, `scent_note.name`, `brand.name` via ILIKE both directions) **+** review weight (`avg_rating * ln(1+review_count)`) **+** taste boost (if signed in) **+** in-stock nudge. WHERE = any of those match. Grant anon+authenticated. This is the "considers reviews + personal + attribute-aware" search; **vibe-only semantic is deferred.**

## 3. Home restructure (mobile) — the approved layout
Kills the twin-slab immersive hero. Fixed anchors, personalized content, products above the fold. Revert the scroll-aware status bar + `light` HeaderActions experiment (header back to ink-on-paper, stable).
```
Header (paper, fixed): greeting · 🔔 · avatar
Search pill  → /search           ← NEW, high-intent path
HERO ~340px: image + bottom scrim only; label · serif title · REAL paper-pill button (44pt)
Shop by note (horizontal cards, ORDERED by fn_my_top_families)  ← peeks under hero
Picked for you →  (first PRODUCT rail — products above the fold)
Collection (COMPACT ~180px text-on-image banner, chosen by fn_rank_collections)  ← after products, half height → no twin-slab
…remaining personalized rails (Recommended/Because you viewed/Back in stock/Still thinking/New in/Trending)…
Browse all N fragrances
```
Rules: one editorial slab per screenful, alternating with product content; distinct grammar per module type (header=paper, hero=big text+button, collection=small banner, rails=white). Anon users also get a **"More like you've browsed"** rail (their `recentlyViewed` newest slug → `fn_similar_products`), so even signed-out homes diverge after the first view.

## 4. Shop + Search wiring (mobile)
- Shop default sort ("For you") → `fn_shop_ranked` (map ids to loaded products); switching to any explicit sort or applying a filter → existing client `lib/search.ts` path.
- Search → `fn_search_products` replaces the current client `searchProducts`; keep recent searches + `track("search",…)`. Explicit filters still apply on top.

## 5. Combos (pair perfumes)
- **DB:** `public.combo` (id, name, slug, description, image_path, `combo_price_minor`, is_active, deleted_at, timestamps) + `public.combo_item` (combo_id, `variant_id`, qty). RLS: public read active (anon+auth), staff manage; `updated_at` trigger; grants like other catalog tables.
- **Admin/POS:** a combos manager (create/edit: name, image, pick variants, set combo price) following the web write pattern + the product-admin conventions; POS can add a combo to a sale (extend `fn_pos_sale` or a `fn_pos_sale` item type). 
- **Mobile:** combo detail + a **"Complete the pair"** rail (on product pages: combos containing this product) and a home **"Perfect pairs"** rail; combo → adds its items to the bag (or a combo line) at the combo price. Consider a `fn_combos_for_product(id)` + `fn_active_combos()` RPC.

## 6. Occasion collections + a richer home (owner asked for recommendations)
- **Occasions (date night / office / casual / signature / summer …):** these are `category` rows (`kind='collection'`); the fallbacks already exist (date-night, office, summer, signature, gourmand-sweet). Add an **occasion** grouping — simplest: a `category.occasion text` tag or a dedicated `is_occasion` flag — and a home **"Shop by occasion"** tile grid. Largely merchant curation via the existing storefront builder + a small mobile module.
- **Recommended additional home modules** (build the high-value ones): ① **Search pill** (done in §3 — highest intent). ② **"Perfect pairs"** combo rail (§5). ③ **"Top rated"** review-driven rail (`avg_rating` desc, min review_count). ④ **"Shop by occasion"** tiles. ⑤ **"Because you searched X"** (last search → `fn_search_products`) once search history is tracked. ⑥ Seasonal/editorial hero rotation. Keep the one-slab-per-screen rhythm; every module must be a trackable surface (impression/tap) so `recs.events` keeps enriching.

## 7. Verification & standards
- Migrations: real-timestamp names (`date -u +%Y%m%d%H%M%S`, check `ls supabase/migrations | tail` right before — parallel sessions collide; rule in root `CLAUDE.md`). Verify RPCs on throwaway PG17+pgvector; owner runs `supabase db push`.
- Mobile: `npx tsc --noEmit` clean; match `mobile/DESIGN.md` (Maison). Web: match `web/DESIGN.md`; `next build`/`tsc` clean.
- Preserve recs invariants: content edits fire the embed trigger; stock writes go through the stock RPCs; `recs` schema stays behind `public.fn_*` wrappers.

## 8. Suggested build order (one chunk per session)
1. **RPCs migration** (§2) + verify. 2. **Home restructure + shop/search wiring** (§3–4). 3. **Combos** (§5). 4. **Occasions + richer home modules** (§6).

## Working protocol
Restate the chunk's scope + "Done when", list files to create/modify, then WAIT for the owner's go before writing code. Keep changes reviewable; list every touched file. Don't touch the recs-core or product-admin tracks except through their documented interfaces.

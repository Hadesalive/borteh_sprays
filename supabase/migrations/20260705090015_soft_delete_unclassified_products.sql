-- 20260705090015_soft_delete_unclassified_products.sql
-- Phase 0 catalog-quality cleanup (RECS_IMPLEMENTATION_PLAN.md gate).
-- Owner decision 2026-07-05: rather than backfill fragrance families, REMOVE the active
-- products that have no scent_family so the recs content model has zero blanks.
--
-- Soft delete only (is_active=false + deleted_at) — the app's standard "remove" mechanism.
-- These rows drop out of every catalog/recs query and the audit gate, order history is
-- untouched (nothing is physically deleted), and it is fully REVERSIBLE (see bottom).
--
-- Self-selecting by the same criterion the audit uses, so it targets exactly the products
-- "without the necessary info". On a fresh `supabase db reset` this matches nothing
-- (products are entered via admin, not seeded in migrations) — a safe local no-op.
--
-- 31 slugs affected at authoring time (2026-07-05):
--   482-avant-garde, 9am, asad-zanzibar, club-de-nuit-untold, club-de-nuit-urban-man-elixir,
--   dukhan, emir-ageratum, emir-botafok, emir-iris-harlww, emir-laverne-immortal, fae, haya,
--   le-de-blanc, maahir-legacy, manificent, mayar-chocolate, musk-malaki, musk-tahara,
--   odyssey-mandarin-sky, olympic-man, oud-experience, oud-mood, philos-aexclusif,
--   pride-al-nashama, ramz-lattafa-gold, raved, teriaq, versatile-cardinal, yara-moi,
--   yara-tous, zimaya-francesca

update public.product
   set is_active  = false,
       deleted_at = now()
 where deleted_at is null
   and is_active
   and (scent_family is null or btrim(scent_family) = '');

-- Reverse a specific product later (e.g. after adding its family in the admin):
--   update public.product set is_active = true, deleted_at = null where slug = '<slug>';

-- 20260706221334_feature_home_collections.sql
-- Home-algo CHUNK 2 follow-up — fill the app home's "Collections" shelf.
-- Features the existing bundled-art collection categories so the swipeable Collections rail has
-- variety to show. Cover images stay null ON PURPOSE: the mobile app falls back to its bundled
-- collection artwork (COLLECTION_FALLBACK) for these slugs, so no storage upload is needed.
-- Reversible (set is_featured_home = false to un-feature); affects only rows that already exist —
-- unknown slugs no-op, already-featured rows are skipped (no needless updated_at churn).

update public.category
set is_featured_home = true,
    updated_at       = now()
where kind = 'collection'
  and deleted_at is null
  and slug in ('summer', 'date-night', 'office', 'signature', 'gourmand-sweet')
  and is_featured_home is distinct from true;

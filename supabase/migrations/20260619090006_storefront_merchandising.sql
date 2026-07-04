-- 20260619090006_storefront_merchandising.sql
-- Phase 1 of admin-managed storefront merchandising for the app home.
-- Lets the owner curate "Shop by brand" and the Collections rail without code:
-- brands and collections (categories) gain home-featuring + ordering, and
-- collections gain a cover image. Additive only; existing RLS/triggers apply.

-- Brands: order + feature on the home "Shop by brand" rail.
alter table public.brand
  add column if not exists sort_order       int     not null default 0,
  add column if not exists is_featured_home boolean not null default false;

-- Collections (category): cover image for the home rail + home featuring.
-- (category.sort_order already exists from the initial schema.)
alter table public.category
  add column if not exists cover_image_path text,
  add column if not exists is_featured_home boolean not null default false;

-- Partial indexes for the home rails: active, featured, in curated order.
create index if not exists idx_brand_featured_home
  on public.brand (sort_order)
  where deleted_at is null and is_active and is_featured_home;

create index if not exists idx_category_featured_home
  on public.category (sort_order)
  where deleted_at is null and is_active and is_featured_home;

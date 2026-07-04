-- 20260620090007_home_carousel.sql
-- Phase 2 of storefront merchandising: the editable app-home hero carousel,
-- plus ordering/featuring for the "Shop by scent" rail.

-- Hero carousel slides shown at the top of the app home.
create table if not exists public.home_carousel (
  id          uuid primary key default gen_random_uuid(),
  image_path  text,
  label       text,                 -- small eyebrow, e.g. "Signature"
  title       text not null,        -- headline, e.g. "Amber & oud"
  cta_text    text,                 -- button label
  link_url    text,                 -- deep link / route the slide opens
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists idx_home_carousel_active
  on public.home_carousel (sort_order)
  where deleted_at is null and is_active;

-- updated_at trigger (the global loop in 090003 ran before this table existed).
create or replace trigger trg_home_carousel_updated
  before update on public.home_carousel
  for each row execute function public.set_updated_at();

-- RLS (the global enable loop in 090004 ran before this table existed):
-- public reads active slides, staff/owner manage everything.
alter table public.home_carousel enable row level security;
create policy cat_read_carousel  on public.home_carousel for select to anon, authenticated using (is_active and deleted_at is null);
create policy cat_staff_carousel on public.home_carousel for all    to authenticated using (public.is_staff()) with check (public.is_staff());

-- "Shop by scent" families: curate order + which appear on the home.
alter table public.scent_note
  add column if not exists sort_order       int     not null default 0,
  add column if not exists is_featured_home boolean not null default false;

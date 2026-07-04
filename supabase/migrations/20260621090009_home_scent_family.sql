-- 20260621090009_home_scent_family.sql
-- Admin-curated "Shop by scent" families for the app home (Storefront builder).
-- A small lookup so the owner controls which families appear + their order;
-- the `family` key matches the scent note families used across the catalog.

create table if not exists public.home_scent_family (
  id          uuid primary key default gen_random_uuid(),
  family      text not null,   -- e.g. 'woody' (matches scent_note.note_family)
  label       text not null,   -- display label, e.g. 'Woody'
  image_path  text,            -- optional Storage cover; else app uses bundled art
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists uq_home_scent_family on public.home_scent_family (family);
create index if not exists idx_home_scent_family_active
  on public.home_scent_family (sort_order) where is_active;

-- updated_at trigger (global loop in 090003 ran before this table existed).
create or replace trigger trg_home_scent_family_updated
  before update on public.home_scent_family
  for each row execute function public.set_updated_at();

-- RLS: public reads active families, staff/owner manage.
alter table public.home_scent_family enable row level security;
create policy cat_read_scentfam  on public.home_scent_family for select to anon, authenticated using (is_active);
create policy cat_staff_scentfam on public.home_scent_family for all    to authenticated using (public.is_staff()) with check (public.is_staff());

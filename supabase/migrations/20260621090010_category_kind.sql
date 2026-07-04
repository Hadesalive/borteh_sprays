-- 20260621090010_category_kind.sql
-- The `category` table holds two different things: real merchandising
-- COLLECTIONS (Summer, Date night, …) and TAXONOMY used for shop filters
-- (gender: men/women/unisex, and the 'oud' scent filter). Add a `kind` so the
-- admin Collections screen and the app home rail only deal with collections.
-- Seeds set kind='taxonomy' for the filter rows; everything else stays 'collection'.

alter table public.category
  add column if not exists kind text not null default 'collection';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'category_kind_chk') then
    alter table public.category
      add constraint category_kind_chk check (kind in ('collection', 'taxonomy'));
  end if;
end $$;

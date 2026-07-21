-- 20260706222325_combos.sql
-- Home-algo CHUNK 3a — Combos (curated perfume pairings). Foundation + read RPCs + a seeded
-- demo pair so the mobile "Perfect pairs" / "Complete the pair" surfaces have something to show.
--
-- Pricing note: combo_price_minor is the eventual DEAL price and is left NULL here. In 3a the
-- app charges the honest live sum of the paired items (no checkout change), so nothing is priced
-- below what the customer actually pays. Deal pricing + the fn_place_order integration land in
-- 3b alongside the admin combos manager (where the owner sets the price + the stacking policy).

-- =====================================================================
-- Tables
-- =====================================================================
create table public.combo (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null,
  description       text,
  image_path        text,                       -- optional own hero; null → app composes the pair's product images
  combo_price_minor bigint check (combo_price_minor is null or combo_price_minor >= 0), -- null = charge item sum (3a)
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create unique index uq_combo_slug   on public.combo (slug) where deleted_at is null;
create index        idx_combo_active on public.combo (created_at desc) where is_active and deleted_at is null;

create table public.combo_item (
  id         uuid primary key default gen_random_uuid(),
  combo_id   uuid not null references public.combo(id) on delete cascade,
  variant_id uuid not null references public.product_variant(id) on delete restrict,
  qty        int  not null default 1 check (qty > 0),
  sort_order int  not null default 0,
  constraint uq_combo_variant unique (combo_id, variant_id)
);
create index idx_combo_item_combo   on public.combo_item (combo_id);
create index idx_combo_item_variant on public.combo_item (variant_id);

create or replace trigger trg_combo_updated
  before update on public.combo
  for each row execute function public.set_updated_at();

-- =====================================================================
-- RLS — public read active (anon + auth), staff manage (admin uses service_role, which bypasses)
-- =====================================================================
alter table public.combo      enable row level security;
alter table public.combo_item enable row level security;

create policy combo_read  on public.combo for select to anon, authenticated using (is_active and deleted_at is null);
create policy combo_staff on public.combo for all    to authenticated using (public.is_staff()) with check (public.is_staff());

create policy combo_item_read on public.combo_item for select to anon, authenticated
  using (exists (select 1 from public.combo c where c.id = combo_id and c.is_active and c.deleted_at is null));
create policy combo_item_staff on public.combo_item for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select on public.combo, public.combo_item to anon, authenticated;
grant all    on public.combo, public.combo_item to service_role;

-- =====================================================================
-- Read RPCs — return combos with their items as jsonb [{variant_id, qty}]; the app resolves
-- product/variant details from its already-loaded catalog. Only fully-available pairs surface
-- (every item active, not deleted, in stock) so the customer can always actually add the pair.
-- =====================================================================
create or replace function public.fn_active_combos(p_limit int default 20)
returns table(id uuid, name text, slug text, description text, image_path text, combo_price_minor bigint, items jsonb)
language sql stable security definer set search_path to 'public'
as $$
  select c.id, c.name, c.slug, c.description, c.image_path, c.combo_price_minor,
    jsonb_agg(jsonb_build_object('variant_id', ci.variant_id, 'qty', ci.qty) order by ci.sort_order, ci.id) as items
  from public.combo c
  join public.combo_item ci on ci.combo_id = c.id
  where c.is_active and c.deleted_at is null
    and not exists (   -- exclude combos with any unavailable item
      select 1 from public.combo_item ci2
      join public.product_variant pv on pv.id = ci2.variant_id
      left join public.availability_signal a on a.variant_id = pv.id
      where ci2.combo_id = c.id
        and (not pv.is_active or pv.deleted_at is not null or coalesce(a.band, 'out') = 'out')
    )
  group by c.id
  having count(ci.*) >= 2   -- a combo is a pair (2+ items)
  order by c.created_at desc
  limit greatest(coalesce(p_limit, 20), 0);
$$;

create or replace function public.fn_combos_for_product(p_product_id uuid, p_limit int default 10)
returns table(id uuid, name text, slug text, description text, image_path text, combo_price_minor bigint, items jsonb)
language sql stable security definer set search_path to 'public'
as $$
  select c.id, c.name, c.slug, c.description, c.image_path, c.combo_price_minor,
    jsonb_agg(jsonb_build_object('variant_id', ci.variant_id, 'qty', ci.qty) order by ci.sort_order, ci.id) as items
  from public.combo c
  join public.combo_item ci on ci.combo_id = c.id
  where c.is_active and c.deleted_at is null
    and exists (   -- the combo includes a variant of this product
      select 1 from public.combo_item ci3
      join public.product_variant pv on pv.id = ci3.variant_id
      where ci3.combo_id = c.id and pv.product_id = p_product_id
    )
    and not exists (   -- and every item is available
      select 1 from public.combo_item ci2
      join public.product_variant pv on pv.id = ci2.variant_id
      left join public.availability_signal a on a.variant_id = pv.id
      where ci2.combo_id = c.id
        and (not pv.is_active or pv.deleted_at is not null or coalesce(a.band, 'out') = 'out')
    )
  group by c.id
  having count(ci.*) >= 2
  order by c.created_at desc
  limit greatest(coalesce(p_limit, 10), 0);
$$;

revoke all on function public.fn_active_combos(int)            from public;
revoke all on function public.fn_combos_for_product(uuid, int) from public;
grant execute on function public.fn_active_combos(int)            to anon, authenticated;
grant execute on function public.fn_combos_for_product(uuid, int) to anon, authenticated;

-- =====================================================================
-- Seed one demo pair from the two most-popular in-stock products (their cheapest available
-- variant). Dynamic → no hard-coded ids; idempotent → only seeds when no combo exists yet.
-- =====================================================================
do $$
declare
  v_combo uuid;
  v_ids   uuid[];
begin
  if exists (select 1 from public.combo where deleted_at is null) then return; end if;

  select array_agg(variant_id order by popularity_score desc, pid)
    into v_ids
  from (
    select distinct on (p.id) pv.id as variant_id, p.popularity_score, p.id as pid
    from public.product p
    join public.product_variant pv on pv.product_id = p.id and pv.is_active and pv.deleted_at is null
    join public.availability_signal a on a.variant_id = pv.id and a.band <> 'out'
    where p.is_active and p.deleted_at is null
    order by p.id, pv.price_minor asc
  ) x;

  if v_ids is null or array_length(v_ids, 1) < 2 then return; end if;

  insert into public.combo (name, slug, description, combo_price_minor)
  values ('The Signature Pair', 'signature-pair',
          'Two of our most-loved scents, curated to wear together — day into night.', null)
  returning id into v_combo;

  insert into public.combo_item (combo_id, variant_id, qty, sort_order)
  values (v_combo, v_ids[1], 1, 0),
         (v_combo, v_ids[2], 1, 1);
end $$;

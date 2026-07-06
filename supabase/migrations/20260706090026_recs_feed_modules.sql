-- 20260706090026_recs_feed_modules.sql
-- Phase 2.4 — feed-module candidate generators. Each returns product ids for one home
-- module; the mobile app composes the feed (dedup across modules, drop thin modules, cap
-- length) and renders. All exclude already-purchased products and (except the anchor lookup)
-- require an in-stock variant. SECURITY DEFINER over the unexposed recs schema; caller via
-- auth.uid(); granted to authenticated (these are personalized).

-- "Because you viewed X": nearest in-stock neighbours of the caller's most-recently-viewed
-- product. Returns the anchor id too, so the app can title the row "Because you viewed <name>".
create or replace function public.fn_because_you_viewed(p_limit int default 12)
returns table(anchor_id uuid, product_id uuid, distance real)
language sql stable security definer set search_path to 'public'
as $$
  with anchor as (
    select ap.id, ap.embedding
    from recs.events e
    join public.product ap on ap.id = e.product_id
    where e.user_id = auth.uid() and e.event_type in ('view','dwell')
      and ap.embedding is not null and ap.is_active and ap.deleted_at is null
    order by e.created_at desc
    limit 1
  )
  select anchor.id, p.id, (p.embedding <=> anchor.embedding)::real
  from anchor
  join public.product p
    on p.id <> anchor.id and p.is_active and p.deleted_at is null and p.embedding is not null
  where exists (
      select 1 from public.product_variant pv join public.availability_signal a on a.variant_id = pv.id
      where pv.product_id = p.id and pv.is_active and pv.deleted_at is null and a.band <> 'out')
    and not exists (
      select 1 from recs.events e2 where e2.user_id = auth.uid() and e2.product_id = p.id and e2.event_type = 'purchase')
  order by p.embedding <=> anchor.embedding
  limit greatest(coalesce(p_limit, 12), 0);
$$;

-- "Back in stock for you": products the caller subscribed to restock that are now in-stock.
create or replace function public.fn_back_in_stock(p_limit int default 12)
returns table(product_id uuid)
language sql stable security definer set search_path to 'public'
as $$
  select p.id
  from public.product p
  where p.is_active and p.deleted_at is null
    and exists (
      select 1 from public.restock_subscription rs
      join public.product_variant pv on pv.id = rs.variant_id and pv.product_id = p.id and pv.is_active and pv.deleted_at is null
      join public.availability_signal a on a.variant_id = pv.id
      where rs.user_id = auth.uid() and rs.status in ('active','notified') and a.band <> 'out')
  order by (
    select max(rs.updated_at) from public.restock_subscription rs
    join public.product_variant pv on pv.id = rs.variant_id and pv.product_id = p.id
    where rs.user_id = auth.uid()
  ) desc nulls last
  limit greatest(coalesce(p_limit, 12), 0);
$$;

-- "New in [your family]": newest in-stock products in the caller's #1 taste family.
create or replace function public.fn_new_in_family(p_limit int default 12)
returns table(product_id uuid, family text)
language sql stable security definer set search_path to 'public'
as $$
  with fam as (select (top_families -> 0 ->> 'family') as family from recs.user_profile where user_id = auth.uid())
  select p.id, fam.family
  from public.product p cross join fam
  where fam.family is not null
    and p.scent_family = fam.family
    and p.is_active and p.deleted_at is null
    and exists (
      select 1 from public.product_variant pv join public.availability_signal a on a.variant_id = pv.id
      where pv.product_id = p.id and pv.is_active and pv.deleted_at is null and a.band <> 'out')
    and not exists (
      select 1 from recs.events e where e.user_id = auth.uid() and e.product_id = p.id and e.event_type = 'purchase')
  order by coalesce(p.release_year, 0) desc, p.created_at desc
  limit greatest(coalesce(p_limit, 12), 0);
$$;

-- "Still thinking about it": products the caller viewed 2+ times, still in stock, not purchased.
create or replace function public.fn_still_thinking(p_limit int default 12)
returns table(product_id uuid, view_count int)
language sql stable security definer set search_path to 'public'
as $$
  select e.product_id, count(*)::int as view_count
  from recs.events e
  join public.product p on p.id = e.product_id and p.is_active and p.deleted_at is null
  where e.user_id = auth.uid() and e.event_type in ('view','dwell')
    and exists (
      select 1 from public.product_variant pv join public.availability_signal a on a.variant_id = pv.id
      where pv.product_id = p.id and pv.is_active and pv.deleted_at is null and a.band <> 'out')
    and not exists (
      select 1 from recs.events e2 where e2.user_id = auth.uid() and e2.product_id = p.id and e2.event_type = 'purchase')
  group by e.product_id
  having count(*) >= 2
  order by max(e.created_at) desc
  limit greatest(coalesce(p_limit, 12), 0);
$$;

revoke all on function public.fn_because_you_viewed(int) from public;
revoke all on function public.fn_back_in_stock(int) from public;
revoke all on function public.fn_new_in_family(int) from public;
revoke all on function public.fn_still_thinking(int) from public;
grant execute on function public.fn_because_you_viewed(int) to authenticated;
grant execute on function public.fn_back_in_stock(int) to authenticated;
grant execute on function public.fn_new_in_family(int) to authenticated;
grant execute on function public.fn_still_thinking(int) to authenticated;

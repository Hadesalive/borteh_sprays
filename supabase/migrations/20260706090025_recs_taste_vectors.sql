-- 20260706090025_recs_taste_vectors.sql
-- Phase 2.3 — taste vectors + "Picked for you" + Trending + cold-start quiz seed.
-- Adds recs.user_profile.taste_embedding (normalized weighted sum of engaged products'
-- embeddings), extends the nightly rollup to compute it, and exposes three public RPCs the
-- app calls. pgvector has no scalar*vector operator, so the weighted sum uses the confirmed
-- form: sum(embedding * array_fill(weight, [384])::vector) then l2_normalize.

alter table recs.user_profile
  add column if not exists taste_embedding vector(384);

-- ---------------------------------------------------------------------------
-- Nightly rollup, now also computing taste_embedding (same weights/decay as the
-- feedback engagement; effectively last-90-days since decay makes older events ~0).
-- ---------------------------------------------------------------------------
create or replace function recs.fn_refresh_user_profiles()
returns integer
language plpgsql
security definer
set search_path to 'public'   -- needs the pgvector `vector` type (lives in public); recs.* stays qualified
as $$
declare
  v_half_life numeric;
  v_weights   jsonb;
  v_count     integer;
begin
  select (value #>> '{}')::numeric into v_half_life from recs.config where key = 'recency.half_life_days';
  v_half_life := coalesce(v_half_life, 14);
  select value into v_weights from recs.config where key = 'feedback.weights';
  v_weights := coalesce(v_weights, '{}'::jsonb);

  with ev as (
    select e.user_id, e.product_id,
      sum(
        coalesce((v_weights ->> e.event_type)::numeric, 0)
        * exp(- extract(epoch from (now() - e.created_at)) / 86400.0 / nullif(v_half_life, 0))
      ) as w
    from recs.events e
    where e.user_id is not null and e.product_id is not null
    group by e.user_id, e.product_id
  ),
  enriched as (
    select ev.user_id, ev.w, p.scent_family, p.brand_id,
      (select min(pv.price_minor) from public.product_variant pv
        where pv.product_id = p.id and pv.is_active and pv.deleted_at is null) as price_minor
    from ev join public.product p on p.id = ev.product_id
    where p.deleted_at is null
  ),
  fam as (
    select user_id,
      jsonb_agg(jsonb_build_object('family', scent_family, 'score', round(s, 4)) order by s desc) as top_families
    from (
      select user_id, scent_family, sum(w) as s,
        row_number() over (partition by user_id order by sum(w) desc) as rn
      from enriched where scent_family is not null group by user_id, scent_family
    ) t where rn <= 3 group by user_id
  ),
  brands as (
    select user_id,
      jsonb_agg(jsonb_build_object('brand_id', brand_id, 'score', round(s, 4)) order by s desc) as brand_affinity
    from (
      select user_id, brand_id, sum(w) as s,
        row_number() over (partition by user_id order by sum(w) desc) as rn
      from enriched where brand_id is not null group by user_id, brand_id
    ) t where rn <= 5 group by user_id
  ),
  price as (
    select user_id,
      percentile_cont(0.25) within group (order by price_minor)::bigint as p25,
      percentile_cont(0.75) within group (order by price_minor)::bigint as p75
    from enriched where price_minor is not null group by user_id
  ),
  taste as (   -- normalized weighted sum of engaged products' embeddings
    select ev.user_id,
      l2_normalize(sum(p.embedding * (array_fill(ev.w::float8, array[384]))::vector)) as taste_embedding
    from ev join public.product p on p.id = ev.product_id
    where p.embedding is not null and p.deleted_at is null
    group by ev.user_id
  ),
  agg as (
    select user_id, count(*) as event_count, max(created_at) as last_active
    from recs.events where user_id is not null group by user_id
  )
  insert into recs.user_profile
    (user_id, top_families, brand_affinity, price_min_minor, price_max_minor,
     event_count, last_active, taste_embedding, refreshed_at)
  select a.user_id,
    coalesce(f.top_families, '[]'::jsonb),
    coalesce(b.brand_affinity, '[]'::jsonb),
    pr.p25, pr.p75, a.event_count::int, a.last_active, ta.taste_embedding, now()
  from agg a
    left join fam f    on f.user_id  = a.user_id
    left join brands b on b.user_id  = a.user_id
    left join price pr on pr.user_id = a.user_id
    left join taste ta on ta.user_id = a.user_id
  on conflict (user_id) do update set
    top_families    = excluded.top_families,
    brand_affinity  = excluded.brand_affinity,
    price_min_minor = excluded.price_min_minor,
    price_max_minor = excluded.price_max_minor,
    event_count     = excluded.event_count,
    last_active     = excluded.last_active,
    taste_embedding = excluded.taste_embedding,
    refreshed_at    = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- "Picked for you": nearest in-stock, not-owned products to the caller's taste vector.
-- SECURITY DEFINER (reads the unexposed recs schema); resolves the caller via auth.uid().
-- ---------------------------------------------------------------------------
create or replace function public.fn_picked_for_you(p_limit int default 20)
returns table(product_id uuid, distance real)
language sql
stable
security definer
set search_path to 'public'
as $$
  with me as (select taste_embedding from recs.user_profile where user_id = auth.uid())
  select p.id, (p.embedding <=> me.taste_embedding)::real as distance
  from public.product p cross join me
  where me.taste_embedding is not null
    and p.is_active and p.deleted_at is null and p.embedding is not null
    and exists (
      select 1 from public.product_variant pv
      join public.availability_signal a on a.variant_id = pv.id
      where pv.product_id = p.id and pv.is_active and pv.deleted_at is null and a.band <> 'out'
    )
    and not exists (
      select 1 from recs.events e
      where e.user_id = auth.uid() and e.product_id = p.id and e.event_type = 'purchase'
    )
  order by p.embedding <=> me.taste_embedding
  limit greatest(coalesce(p_limit, 20), 0);
$$;

-- ---------------------------------------------------------------------------
-- Trending: 7-day weighted popularity over in-stock products — the universal fallback
-- (works for anon / cold-start, no personalization needed). Negative signals floored at 0.
-- ---------------------------------------------------------------------------
create or replace function public.fn_trending(p_limit int default 20)
returns table(product_id uuid, score numeric)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_weights jsonb;
begin
  select value into v_weights from recs.config where key = 'feedback.weights';
  v_weights := coalesce(v_weights, '{}'::jsonb);
  return query
    select e.product_id, sum(greatest(coalesce((v_weights ->> e.event_type)::numeric, 0), 0)) as score
    from recs.events e
    join public.product p on p.id = e.product_id
    where e.product_id is not null
      and e.created_at >= now() - interval '7 days'
      and p.is_active and p.deleted_at is null
      and exists (
        select 1 from public.product_variant pv
        join public.availability_signal a on a.variant_id = pv.id
        where pv.product_id = p.id and pv.is_active and pv.deleted_at is null and a.band <> 'out'
      )
    group by e.product_id
    having sum(greatest(coalesce((v_weights ->> e.event_type)::numeric, 0), 0)) > 0
    order by 2 desc
    limit greatest(coalesce(p_limit, 20), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Cold-start quiz seed: average embedding of products matching (family, concentration,
-- max price) → seed the caller's taste vector instantly. Overwritten by the nightly rollup
-- once the user has real events.
-- ---------------------------------------------------------------------------
create or replace function public.fn_seed_taste_from_quiz(
  p_family text default null,
  p_concentration text default null,
  p_max_price bigint default null
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_vec vector(384);
  v_n   integer;
begin
  if v_uid is null then return 0; end if;
  select l2_normalize(sum(p.embedding)), count(*)
    into v_vec, v_n
  from public.product p
  where p.is_active and p.deleted_at is null and p.embedding is not null
    and (p_family is null        or p.scent_family ilike '%' || p_family || '%')
    and (p_concentration is null  or exists (select 1 from public.product_variant pv
           where pv.product_id = p.id and pv.concentration = p_concentration and pv.is_active and pv.deleted_at is null))
    and (p_max_price is null       or exists (select 1 from public.product_variant pv
           where pv.product_id = p.id and pv.price_minor <= p_max_price and pv.is_active and pv.deleted_at is null));
  if v_vec is null then return 0; end if;
  insert into recs.user_profile (user_id, taste_embedding, refreshed_at)
    values (v_uid, v_vec, now())
  on conflict (user_id) do update set taste_embedding = excluded.taste_embedding, refreshed_at = now();
  return v_n;
end;
$$;

-- Grants: personalization RPCs need a signed-in user; trending is open (cold-start fallback).
revoke all on function public.fn_picked_for_you(int) from public;
revoke all on function public.fn_seed_taste_from_quiz(text, text, bigint) from public;
grant execute on function public.fn_picked_for_you(int) to authenticated;
grant execute on function public.fn_seed_taste_from_quiz(text, text, bigint) to authenticated;
grant execute on function public.fn_trending(int) to anon, authenticated;

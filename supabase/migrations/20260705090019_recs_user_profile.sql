-- 20260705090019_recs_user_profile.sql
-- Phase 1.4 — nightly per-user profile rollup. Aggregates recs.events (weighted by the
-- recs.config feedback weights + recency half-life) joined to catalog data into one row per
-- signed-in user: weighted top-3 families, engaged price band (p25-p75), brand affinities,
-- event count, last_active. Powers rules, ranker features, and debugging. Recomputed nightly.

create table if not exists recs.user_profile (
  user_id         uuid primary key,
  top_families    jsonb  not null default '[]',   -- [{family, score}] strongest first, top 3
  brand_affinity  jsonb  not null default '[]',   -- [{brand_id, score}] strongest first, top 5
  price_min_minor bigint,                          -- p25 of engaged product prices
  price_max_minor bigint,                          -- p75 of engaged product prices
  event_count     int    not null default 0,
  last_active     timestamptz,
  refreshed_at    timestamptz not null default now()
);

alter table recs.user_profile enable row level security;
-- Server-only (recs schema is unexposed; no client policies). service_role reads/writes.
grant select, insert, update, delete on recs.user_profile to service_role;

-- ---------------------------------------------------------------------------
-- Full recompute (cheap at this scale). Reads all tunables from recs.config.
-- ---------------------------------------------------------------------------
create or replace function recs.fn_refresh_user_profiles()
returns integer
language plpgsql
security definer
set search_path to ''
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

  with ev as (   -- weighted engagement per (user, product), product-linked events only
    select
      e.user_id,
      e.product_id,
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
  agg as (   -- counts from ALL user events (activity/confidence proxy)
    select user_id, count(*) as event_count, max(created_at) as last_active
    from recs.events where user_id is not null group by user_id
  )
  insert into recs.user_profile
    (user_id, top_families, brand_affinity, price_min_minor, price_max_minor, event_count, last_active, refreshed_at)
  select a.user_id,
    coalesce(f.top_families, '[]'::jsonb),
    coalesce(b.brand_affinity, '[]'::jsonb),
    pr.p25, pr.p75, a.event_count::int, a.last_active, now()
  from agg a
    left join fam f    on f.user_id  = a.user_id
    left join brands b on b.user_id  = a.user_id
    left join price pr on pr.user_id = a.user_id
  on conflict (user_id) do update set
    top_families    = excluded.top_families,
    brand_affinity  = excluded.brand_affinity,
    price_min_minor = excluded.price_min_minor,
    price_max_minor = excluded.price_max_minor,
    event_count     = excluded.event_count,
    last_active     = excluded.last_active,
    refreshed_at    = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nightly schedule via pg_cron when available; the migration still succeeds (table +
-- function land) if pg_cron isn't enabled — just run fn_refresh_user_profiles() elsewhere.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    if exists (select 1 from cron.job where jobname = 'recs-refresh-user-profiles') then
      perform cron.unschedule('recs-refresh-user-profiles');
    end if;
    perform cron.schedule('recs-refresh-user-profiles', '0 2 * * *', 'select recs.fn_refresh_user_profiles();');
  else
    raise notice 'pg_cron unavailable — schedule recs.fn_refresh_user_profiles() nightly externally';
  end if;
exception when others then
  raise notice 'pg_cron scheduling skipped (%) — run recs.fn_refresh_user_profiles() nightly externally', sqlerrm;
end $$;

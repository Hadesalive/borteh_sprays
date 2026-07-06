-- 20260706151536_recs_collaborative_filtering.sql
-- Phase 3 — collaborative filtering via item-item co-occurrence over positive engagement:
-- "users who engaged X also engaged Y" (cosine over the user×item matrix). Chosen over
-- ALS/implicit (Python) because at this data scale co-occurrence is more robust and runs
-- entirely in-DB (no Python/CI), like the nightly rollup. Deliverable shape matches the plan:
-- recs.cf_candidates + model_version + freshness + a master kill-switch + a degenerate-data
-- guardrail (a broken/degenerate run keeps the previous model instead of overwriting it).

create table if not exists recs.cf_candidates (
  user_id       uuid not null,
  product_id    uuid not null,
  score         real not null,
  model_version timestamptz not null,
  created_at    timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index if not exists idx_cf_candidates_user on recs.cf_candidates (user_id, score desc);
alter table recs.cf_candidates enable row level security;   -- server-only; service_role bypasses
grant select, insert, update, delete on recs.cf_candidates to service_role;

-- Tunables (Phase 3's keys; added here, not in the Phase-0 seed).
insert into recs.config (key, value, description) values
  ('cf.enabled', 'true'::jsonb, 'Master kill-switch: serve collaborative-filtering candidates in the feed.'),
  ('cf.min_events_for_cf', '5'::jsonb, 'Users with fewer events than this stay pure content-based (no CF).'),
  ('cf.model_freshness_hours', '48'::jsonb, 'CF candidates are only served while the latest model_version is newer than this.')
on conflict (key) do nothing;

-- Nightly recompute. Rewrites candidates in one transaction, but ONLY when the data is healthy
-- (guardrail); otherwise returns 0 and leaves the previous model in place. Returns rows written.
create or replace function recs.fn_refresh_cf_candidates()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_weights jsonb;
  v_users   int;
  v_top     numeric;
  v_written int;
  v_version timestamptz := now();
begin
  select coalesce(value, '{}'::jsonb) into v_weights from recs.config where key = 'feedback.weights';

  -- positive per-(user,product) engagement
  drop table if exists _cf_ui;
  create temporary table _cf_ui on commit drop as
    select e.user_id, e.product_id,
           sum(greatest(coalesce((v_weights ->> e.event_type)::numeric, 0), 0)) as w
    from recs.events e
    where e.user_id is not null and e.product_id is not null
    group by e.user_id, e.product_id
    having sum(greatest(coalesce((v_weights ->> e.event_type)::numeric, 0), 0)) > 0;

  -- Guardrails: need ≥2 distinct users, and no single product may exceed 50% of interactions.
  select count(distinct user_id) into v_users from _cf_ui;
  select coalesce(max(cnt)::numeric / nullif(sum(cnt), 0), 1) into v_top
    from (select product_id, count(*) as cnt from _cf_ui group by product_id) t;
  if coalesce(v_users, 0) < 2 or coalesce(v_top, 1) > 0.5 then
    return 0;   -- degenerate; keep the previous model
  end if;

  -- item-item cosine similarity from co-engagement
  drop table if exists _cf_sim;
  create temporary table _cf_sim on commit drop as
    with norms as (select product_id, sqrt(sum(w * w)) as nrm from _cf_ui group by product_id)
    select a.product_id as i, b.product_id as j,
           sum(a.w * b.w) / nullif(na.nrm * nb.nrm, 0) as sim
    from _cf_ui a
    join _cf_ui b on a.user_id = b.user_id and a.product_id <> b.product_id
    join norms na on na.product_id = a.product_id
    join norms nb on nb.product_id = b.product_id
    group by a.product_id, b.product_id, na.nrm, nb.nrm;

  -- per-user top-50 candidates = Σ sim(engaged_i, candidate_j) × engagement, excluding engaged
  with scored as (
    select ui.user_id, s.j as product_id, sum(s.sim * ui.w) as score,
           row_number() over (partition by ui.user_id order by sum(s.sim * ui.w) desc) as rn
    from _cf_ui ui
    join _cf_sim s on s.i = ui.product_id
    where not exists (select 1 from _cf_ui x where x.user_id = ui.user_id and x.product_id = s.j)
    group by ui.user_id, s.j
  )
  insert into recs.cf_candidates (user_id, product_id, score, model_version, created_at)
  select user_id, product_id, score::real, v_version, now() from scored where rn <= 50
  on conflict (user_id, product_id) do update
    set score = excluded.score, model_version = excluded.model_version, created_at = now();

  get diagnostics v_written = row_count;
  delete from recs.cf_candidates where model_version < v_version;  -- drop rows not regenerated
  return v_written;
end;
$$;

-- Serve CF candidates for the caller — respects the kill-switch, model freshness, and the
-- min-events floor (low-signal users stay content-based). In-stock, not-owned only.
create or replace function public.fn_cf_picks(p_limit int default 12)
returns table(product_id uuid, score real)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_enabled boolean;
  v_fresh numeric;
  v_min int;
  v_events int;
begin
  if v_uid is null then return; end if;
  select (value #>> '{}')::boolean into v_enabled from recs.config where key = 'cf.enabled';
  if not coalesce(v_enabled, false) then return; end if;
  select (value #>> '{}')::numeric into v_fresh from recs.config where key = 'cf.model_freshness_hours';
  select (value #>> '{}')::int     into v_min   from recs.config where key = 'cf.min_events_for_cf';
  select count(*) into v_events from recs.events where user_id = v_uid;
  if v_events < coalesce(v_min, 5) then return; end if;

  return query
    select c.product_id, c.score
    from recs.cf_candidates c
    join public.product p on p.id = c.product_id and p.is_active and p.deleted_at is null
    where c.user_id = v_uid
      and c.model_version >= now() - make_interval(hours => coalesce(v_fresh, 48)::int)
      and exists (
        select 1 from public.product_variant pv join public.availability_signal a on a.variant_id = pv.id
        where pv.product_id = p.id and pv.is_active and pv.deleted_at is null and a.band <> 'out')
      and not exists (
        select 1 from recs.events e where e.user_id = v_uid and e.product_id = p.id and e.event_type = 'purchase')
    order by c.score desc
    limit greatest(coalesce(p_limit, 12), 0);
end;
$$;

revoke all on function public.fn_cf_picks(int) from public;
grant execute on function public.fn_cf_picks(int) to authenticated;

-- Nightly schedule via pg_cron when available (03:30 UTC, after profiles + embeds); safe no-op otherwise.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    if exists (select 1 from cron.job where jobname = 'recs-refresh-cf') then perform cron.unschedule('recs-refresh-cf'); end if;
    perform cron.schedule('recs-refresh-cf', '30 3 * * *', 'select recs.fn_refresh_cf_candidates();');
  else
    raise notice 'pg_cron unavailable — run recs.fn_refresh_cf_candidates() nightly externally';
  end if;
exception when others then
  raise notice 'pg_cron scheduling skipped (%) — run recs.fn_refresh_cf_candidates() nightly externally', sqlerrm;
end $$;

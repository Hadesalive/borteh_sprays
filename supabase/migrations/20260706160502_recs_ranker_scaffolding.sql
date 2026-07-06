-- 20260706160502_recs_ranker_scaffolding.sql
-- Phase 4 scaffolding — learning-to-rank. Builds everything that can exist BEFORE there's
-- enough data to train a model (~10k events): a versioned model registry, the reusable
-- FEATURE LAYER (same features at train + inference time), a labeled training-example
-- generator, and a ranker kill-switch (off until a model is trained + activated). The
-- LightGBM model, training job, and scoring service come online later; until `rank.enabled`
-- flips true with an active model, serving falls back to the Phase 2–3 rules feed.

-- Versioned models. Exactly one row may be active (partial unique index); the trainer inserts
-- a new version + metrics and flips is_active; the serving layer loads the active artifact.
create table if not exists recs.model_registry (
  id            bigint generated always as identity primary key,
  model_version text not null unique,
  feature_list  jsonb not null,                 -- ordered feature names the artifact expects
  artifact_path text,                            -- storage-bucket path to the model file
  metrics       jsonb not null default '{}',     -- {ndcg10, recall10, baseline_ndcg10, ...}
  is_active     boolean not null default false,
  created_at    timestamptz not null default now()
);
create unique index if not exists uq_model_registry_active on recs.model_registry (is_active) where is_active;
alter table recs.model_registry enable row level security;
grant select, insert, update, delete on recs.model_registry to service_role;

-- Ranker kill-switch (off until a model exists). rank.candidate_pool caps how many candidates
-- the ranker scores per request.
insert into recs.config (key, value, description) values
  ('rank.enabled', 'false'::jsonb, 'Serve the learned ranker ordering (needs an active recs.model_registry row). Off until Phase 4 activates.'),
  ('rank.candidate_pool', '120'::jsonb, 'Max candidates gathered from all sources before the ranker scores them.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- FEATURE LAYER — the ~15 features per (user, candidate product). Used identically at
-- training (fn_training_examples joins it) and inference (the serving layer calls it).
-- ---------------------------------------------------------------------------
create or replace function recs.fn_candidate_features(p_user uuid, p_product_ids uuid[])
returns table(
  product_id uuid, taste_sim real, cf_score real, pop_7d real, pop_30d real,
  price_dist real, family_match int, brand_affinity real, days_since_seen real,
  product_age_days real, stock_level int, user_event_count int, rating real, review_count int
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with me as (
    select taste_embedding, top_families, brand_affinity, price_min_minor, price_max_minor,
           coalesce(event_count, 0) as event_count
    from recs.user_profile where user_id = p_user
  ),
  w as (select coalesce(value, '{}'::jsonb) as weights from recs.config where key = 'feedback.weights')
  select
    p.id,
    case when p.embedding is not null and me.taste_embedding is not null
         then (1 - (p.embedding <=> me.taste_embedding))::real else 0 end,
    coalesce((select c.score from recs.cf_candidates c where c.user_id = p_user and c.product_id = p.id), 0)::real,
    coalesce((select sum(greatest(coalesce((w.weights ->> e.event_type)::numeric, 0), 0))
              from recs.events e where e.product_id = p.id and e.created_at >= now() - interval '7 days'), 0)::real,
    coalesce((select sum(greatest(coalesce((w.weights ->> e.event_type)::numeric, 0), 0))
              from recs.events e where e.product_id = p.id and e.created_at >= now() - interval '30 days'), 0)::real,
    (case when me.price_min_minor is null then 0 else greatest(
        coalesce(me.price_min_minor, 0) - coalesce((select min(pv.price_minor) from public.product_variant pv
          where pv.product_id = p.id and pv.is_active and pv.deleted_at is null), 0),
        coalesce((select min(pv.price_minor) from public.product_variant pv
          where pv.product_id = p.id and pv.is_active and pv.deleted_at is null), 0) - coalesce(me.price_max_minor, 0),
        0) / 1000.0 end)::real,
    (case when me.top_families is not null and p.scent_family is not null
          and exists (select 1 from jsonb_array_elements(me.top_families) tf where tf ->> 'family' = p.scent_family)
          then 1 else 0 end),
    coalesce((select (ba ->> 'score')::real from jsonb_array_elements(me.brand_affinity) ba
              where (ba ->> 'brand_id')::uuid = p.brand_id limit 1), 0),
    coalesce((select extract(epoch from (now() - max(e.created_at))) / 86400.0
              from recs.events e where e.user_id = p_user and e.product_id = p.id), 365)::real,
    (extract(epoch from (now() - p.created_at)) / 86400.0)::real,
    coalesce((select max(case a.band when 'in_stock' then 2 when 'low' then 1 else 0 end)
              from public.product_variant pv join public.availability_signal a on a.variant_id = pv.id
              where pv.product_id = p.id and pv.is_active and pv.deleted_at is null), 0),
    coalesce(me.event_count, 0),
    coalesce(p.avg_rating, 0)::real,
    coalesce(p.review_count, 0)
  from public.product p
  left join me on true
  cross join w
  where p.id = any(p_product_ids);
$$;

-- ---------------------------------------------------------------------------
-- Labeled training rows: one per (user, product) the user was exposed to, labeled by the
-- strongest engagement (purchase 3, add_to_bag 2, tap/wishlist 1, view-only 0). group_day is
-- the lambdarank query group + enables a time-based train/validation split. NOTE: today's
-- module_impression is module-level (no product_id), so negatives come from view-only rows;
-- per-item impression logging would add more true negatives — a documented future upgrade.
create or replace function recs.fn_training_examples()
returns table(user_id uuid, product_id uuid, module text, rail_position int, label int, group_day date)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    e.user_id, e.product_id,
    (array_agg(e.module order by e.created_at) filter (where e.module is not null))[1],
    (array_agg(e.position order by e.created_at) filter (where e.position is not null))[1],
    max(case e.event_type
          when 'purchase' then 3 when 'review' then 3 when 'add_to_bag' then 2
          when 'module_tap' then 1 when 'wishlist_add' then 1 else 0 end),
    min(e.created_at)::date
  from recs.events e
  where e.user_id is not null and e.product_id is not null
  group by e.user_id, e.product_id;
$$;

grant execute on function recs.fn_candidate_features(uuid, uuid[]) to service_role;
grant execute on function recs.fn_training_examples() to service_role;

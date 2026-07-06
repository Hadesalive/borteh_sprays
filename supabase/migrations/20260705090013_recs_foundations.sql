-- 20260705090013_recs_foundations.sql
-- Recommendation system — Phase 0 foundations (see RECS_IMPLEMENTATION_PLAN.md).
-- Establishes: pgvector, a dedicated `recs` schema kept OUT of the PostgREST API,
-- and `recs.config` — the single home for every tunable (weights, thresholds, feed
-- length, module toggles). Nothing in the recs pipeline is hardcoded; it reads here.
--
-- The `recs` schema is intentionally NOT added to config.toml `schemas`, so no client
-- can reach these tables via the REST API. Server-side work (feed assembly, training,
-- rollups) uses the service-role key, which bypasses RLS. RLS is still enabled below as
-- defense-in-depth in case the schema is ever exposed.

-- 1. pgvector (embedding columns land in a later session; enabling now is Phase 0).
--    Matches this repo's convention of creating extensions in the default schema.
create extension if not exists vector;

-- 2. Dedicated schema for all ML/recs tables, separate from app tables.
create schema if not exists recs;

-- Server-side work (feed assembly, training jobs, admin config panel) reaches recs
-- through a trusted/privileged connection as service_role. service_role bypasses RLS
-- but NOT grants, so it needs schema usage; per-table grants follow each table.
grant usage on schema recs to service_role;

-- 3. Tunables. value is jsonb so a key can hold a scalar, object, or array.
create table if not exists recs.config (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

alter table recs.config enable row level security;
-- No policies + no client grants ⇒ clients cannot read/write; service_role bypasses RLS.
-- Config is server-managed (read by feed assembly, edited by the Phase 5 admin panel).
grant select, insert, update, delete on recs.config to service_role;

create or replace trigger trg_recs_config_updated
  before update on recs.config
  for each row execute function public.set_updated_at();

-- 4. Seed defaults. Re-runnable: existing keys are left untouched (tune in place).
--    Only Phase 0 + Phase 1.2 tunables are seeded here; later phases (CF, ranker,
--    A/B, exploration) add their own keys in their own sessions.
insert into recs.config (key, value, description) values
  ('feed.length',
   '24'::jsonb,
   'Total number of items in the assembled home feed.'),

  ('recency.half_life_days',
   '14'::jsonb,
   'Half-life (days) for time-decaying event weight in the taste vector: e^(-days_ago/half_life).'),

  ('feedback.weights',
   '{"view":1,"dwell":2,"wishlist_add":3,"add_to_bag":4,"purchase":5,"notify_subscribe":3,"review":4,"not_interested":-3,"remove_from_bag":-1,"wishlist_remove":-1}'::jsonb,
   'Phase 1.2 implicit-feedback weights, keyed by event_type. Signals without a weight (search, filter, module_impression, module_tap) are context/eval only.'),

  ('feedback.dwell_threshold_ms',
   '10000'::jsonb,
   'A dwell event is only counted (weight 2) when time-on-product exceeds this many ms.'),

  ('blend.weights',
   '{"content":1.0,"collaborative":0.0,"trending":0.5}'::jsonb,
   'Candidate-source blend weights. collaborative stays 0 until Phase 3 (ALS) is activated.'),

  ('modules.enabled',
   '{"hero":true,"featured":true,"picked_for_you":true,"because_you_viewed":true,"layers_well_with":true,"back_in_stock":true,"still_thinking":true,"new_in_family":true,"trending":true}'::jsonb,
   'Per-module on/off toggles for the home feed.')
on conflict (key) do nothing;

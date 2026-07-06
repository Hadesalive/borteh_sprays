-- 20260705090014_recs_events.sql
-- Recommendation system — Phase 1.1 event pipeline (see RECS_IMPLEMENTATION_PLAN.md).
-- Append-only first-party interaction log + the ONLY sanctioned client write path.
--
-- Security model (three layers):
--   1. The `recs` schema is not exposed to PostgREST, so clients cannot touch this
--      table via the REST API at all.
--   2. The single write path is public.fn_track_events(jsonb) — a SECURITY DEFINER
--      batch RPC that forces user_id := auth.uid(), so a client can never forge another
--      user's events regardless of payload.
--   3. RLS below is defense-in-depth: even with direct table access an authenticated
--      user could only insert rows attributed to themselves and could read nothing.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists recs.events (
  id          bigint generated always as identity primary key,
  -- Forced to auth.uid() by fn_track_events. Nullable so pre-sign-in (anon) events are
  -- allowed; the check below guarantees at least one actor id is present. No FK on
  -- purpose: this is an append-only log that must survive product/user soft-deletes;
  -- the Phase 6 privacy job handles deletion cascades.
  user_id     uuid,
  anon_id     text,                                  -- device id before sign-in; merged on auth (Phase 1.3)
  event_type  text not null check (event_type in
    ('view','dwell','search','filter','add_to_bag','remove_from_bag',
     'purchase','wishlist_add','wishlist_remove','notify_subscribe',
     'review','not_interested','module_impression','module_tap')),
  product_id  uuid,                                  -- bare uuid (no FK) — see user_id note
  module      text,                                  -- which home module served it (context!)
  position    int,                                   -- rank position within that module
  metadata    jsonb not null default '{}',           -- dwell_ms, search query, filter values
  created_at  timestamptz not null default now(),    -- event time (client may supply; clamped ≤ now())
  -- Every event must be attributable to a signed-in user or an anon device.
  constraint events_actor_present
    check (user_id is not null or anon_id is not null),
  -- module + position are mandatory context on every surface impression/tap — this is
  -- what makes Phase 4 evaluation and position de-biasing possible.
  constraint events_surface_context
    check (
      event_type not in ('module_impression','module_tap')
      or (module is not null and position is not null)
    )
);

create index if not exists idx_events_user_time
  on recs.events (user_id, created_at desc);
create index if not exists idx_events_product_type
  on recs.events (product_id, event_type);
-- Supports the Phase 1.3 anon→user merge and anon-only rollups.
create index if not exists idx_events_anon_time
  on recs.events (anon_id, created_at desc) where anon_id is not null;

-- ---------------------------------------------------------------------------
-- RLS (defense-in-depth; see header)
-- ---------------------------------------------------------------------------
alter table recs.events enable row level security;

-- Own-insert only: a row's user_id must equal the caller's uid.
drop policy if exists events_insert_own on recs.events;
create policy events_insert_own
  on recs.events for insert to authenticated
  with check (user_id = auth.uid());

-- No SELECT/UPDATE/DELETE policy for anon or authenticated ⇒ no client read or mutation.
-- service_role bypasses RLS entirely ⇒ training / rollups read freely (grant below).
-- Append-only: writes arrive only through fn_track_events, so service_role gets read only.
grant select on recs.events to service_role;

-- ---------------------------------------------------------------------------
-- Sole client write path: batched, SECURITY DEFINER, forces user_id := auth.uid()
-- ---------------------------------------------------------------------------
-- p_events: a jsonb ARRAY of event objects, each:
--   { event_type, product_id?, module?, position?, anon_id?, metadata?, created_at? }
-- user_id is NEVER read from the payload — it is stamped from the caller's JWT.
-- Returns the number of rows inserted.
create or replace function public.fn_track_events(p_events jsonb)
returns integer
language plpgsql
security definer
set search_path to ''                    -- hardened: fully-qualify all non-pg_catalog objects
as $$
declare
  v_inserted integer;
begin
  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    return 0;
  end if;

  insert into recs.events
    (user_id, anon_id, event_type, product_id, module, position, metadata, created_at)
  select
    auth.uid(),                                              -- forced; payload user_id ignored
    nullif(e->>'anon_id', ''),
    e->>'event_type',
    nullif(e->>'product_id', '')::uuid,
    nullif(e->>'module', ''),
    nullif(e->>'position', '')::int,
    coalesce(e->'metadata', '{}'::jsonb),
    least(coalesce(nullif(e->>'created_at', '')::timestamptz, now()), now())  -- no future-dating
  from jsonb_array_elements(p_events) as e
  where coalesce(e->>'event_type', '') <> '';                -- skip rows with no type

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- Only signed-in and anonymous app roles may call it; nothing else.
revoke all on function public.fn_track_events(jsonb) from public;
grant execute on function public.fn_track_events(jsonb) to authenticated, anon;

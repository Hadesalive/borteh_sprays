-- recs_events_rls.sql — manual RLS proof for recs.events (NOT a migration).
-- Proves the four cases from the Session 1 done-when:
--   own-insert ✓ | cross-user insert ✗ | client read ✗ | service-role read ✓
--
-- Runs entirely inside a transaction that ROLLS BACK, so it seeds nothing permanent and
-- the temporary grants it needs are undone. In production, authenticated/anon have NO
-- access to the recs schema at all; this test grants authenticated just enough to prove
-- that the RLS policy — not merely the missing grant — is what gates the rows.
--
-- Run against the LOCAL Supabase stack:
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -f supabase/tests/recs_events_rls.sql
-- or simply:  supabase db reset  then   psql <local db url> -f supabase/tests/recs_events_rls.sql

\set ON_ERROR_STOP on
\set userA '11111111-1111-1111-1111-111111111111'
\set userB '22222222-2222-2222-2222-222222222222'

begin;

-- Temp grants (rolled back) so authenticated can even attempt to touch the table.
grant usage on schema recs to authenticated;
grant select, insert on recs.events to authenticated;

-- Seed one row per user as the table owner (owner bypasses RLS) so there is data to read.
insert into recs.events (user_id, event_type) values
  (:'userA'::uuid, 'view'),
  (:'userB'::uuid, 'view');

-- Become authenticated user A (auth.uid() reads request.jwt.claims->>'sub').
select set_config('request.jwt.claims',
  json_build_object('sub', :'userA', 'role', 'authenticated')::text, true);
set local role authenticated;

-- 1) own-insert ✓
insert into recs.events (user_id, event_type) values (:'userA'::uuid, 'add_to_bag');
\echo 'PASS ✓  own-insert allowed'

-- 2) cross-user insert ✗  (RLS WITH CHECK → SQLSTATE 42501)
do $$
begin
  insert into recs.events (user_id, event_type)
    values ('22222222-2222-2222-2222-222222222222'::uuid, 'add_to_bag');
  raise exception 'FAIL ✗  cross-user insert was ALLOWED';
exception when insufficient_privilege then
  raise notice 'PASS ✓  cross-user insert blocked by RLS (%)', sqlerrm;
end $$;

-- 3) client read ✗  (has SELECT grant, but no policy ⇒ 0 rows despite data existing)
do $$
declare n int;
begin
  select count(*) into n from recs.events;
  if n <> 0 then raise exception 'FAIL ✗  authenticated read returned % rows', n; end if;
  raise notice 'PASS ✓  authenticated read returns 0 rows (no select policy)';
end $$;

-- 4) service-role read ✓  (bypasses RLS; grant from the migration)
reset role;
set local role service_role;
do $$
declare n int;
begin
  select count(*) into n from recs.events;
  if n < 2 then raise exception 'FAIL ✗  service_role read returned % rows', n; end if;
  raise notice 'PASS ✓  service_role reads % row(s)', n;
end $$;

reset role;
rollback;

\echo ''
\echo 'RLS proof complete — transaction rolled back, no data persisted.'

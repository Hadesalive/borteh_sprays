-- 20260706092002_fn_product_engagement.sql
-- fn_product_engagement: per-type interaction counts for one product, read from recs.events.
-- recs.events is NOT exposed to PostgREST (recs schema is unexposed), so the admin cannot read
-- it directly; this SECURITY DEFINER wrapper in public is the sanctioned read path. Returns one
-- row per event_type present, with total events and distinct actors (signed-in user OR anon
-- device). service_role-only — the admin read client uses the secret (service_role) key.
--
-- Read-only: it never writes. It surfaces the ML signal per product without mutating it.

create or replace function public.fn_product_engagement(p_product_id uuid)
returns table(event_type text, events bigint, users bigint)
language sql
stable
security definer
set search_path to ''
as $$
  select e.event_type,
         count(*)::bigint,
         count(distinct coalesce(e.user_id::text, e.anon_id))::bigint
  from recs.events e
  where e.product_id = p_product_id
  group by e.event_type;
$$;

revoke all     on function public.fn_product_engagement(uuid) from public, anon, authenticated;
grant  execute on function public.fn_product_engagement(uuid) to service_role;

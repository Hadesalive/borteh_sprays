-- 20260705090016_fn_merge_anon_events.sql
-- Phase 1.3 anon->user merge. When a device that was emitting anonymous events signs in,
-- claim those events for the now-authenticated user. SECURITY DEFINER + forced auth.uid()
-- means a caller can only ever merge events onto THEIR OWN user_id, and only rows still
-- unattributed (user_id is null) for the given anon_id. Idempotent and safe to re-call.
create or replace function public.fn_merge_anon_events(p_anon_id text)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_merged integer;
begin
  if v_uid is null or coalesce(p_anon_id, '') = '' then
    return 0;
  end if;

  update recs.events
     set user_id = v_uid
   where anon_id = p_anon_id
     and user_id is null;

  get diagnostics v_merged = row_count;
  return v_merged;
end;
$$;

-- Only a signed-in user may claim events; nothing else.
revoke all on function public.fn_merge_anon_events(text) from public;
grant execute on function public.fn_merge_anon_events(text) to authenticated;

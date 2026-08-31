-- Bug: opting out of the public leaderboard (show_on_leaderboard = false) also hid the
-- caller's own row from fn_leaderboard, because the opt-out flag was checked inside the
-- `ranked` CTE — the same filter that computes rank numbers in the first place. An opted-out
-- customer's row never entered `ranked` at all, so the outer `... or user_id = auth.uid()`
-- clause had nothing left to match. Product intent (per the owner): a customer can always see
-- their own rank; the opt-out only controls whether OTHER customers can see them.
--
-- Fix: rank over every eligible customer regardless of show_on_leaderboard (so an opted-out
-- customer still gets a real rank number), then apply the opt-out filter only to the *returned
-- rows* — never to the caller's own row. A private customer occupying a top-N slot simply
-- doesn't appear to other viewers, leaving a gap in the rank sequence; the client already
-- renders that as a "···" divider (see leaderboard.tsx's own gap-row logic), so this needs no
-- client change to look correct.
create or replace function public.fn_leaderboard(p_limit int default 20)
returns table (
  rank        bigint,
  name        text,
  spend_minor bigint,
  avatar_path text,
  is_me       boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select
      u.id as user_id,
      coalesce(nullif(btrim(u.display_name), ''), 'Borteh member') as name,
      u.avatar_path,
      la.lifetime_spend_minor as spend_minor,
      coalesce(u.show_on_leaderboard, true) as show_on_leaderboard,
      rank()       over (order by la.lifetime_spend_minor desc)                   as rnk,
      row_number() over (order by la.lifetime_spend_minor desc, u.created_at asc) as rn
    from public.loyalty_account la
    join public.app_user u on u.id = la.user_id
    where u.role = 'customer'
      and u.is_blocked = false
      and la.lifetime_spend_minor > 0
  )
  select rnk, name, spend_minor, avatar_path, (user_id = auth.uid()) as is_me
  from ranked
  where (show_on_leaderboard and rn <= greatest(p_limit, 1))
     or user_id = auth.uid()
  order by rn;
$$;

revoke all on function public.fn_leaderboard(int) from public;
grant execute on function public.fn_leaderboard(int) to anon, authenticated;

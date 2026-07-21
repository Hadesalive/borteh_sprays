-- Rank the leaderboard off REAL delivered orders, not loyalty_account.lifetime_spend_minor.
--
-- Why: lifetime_spend_minor is only bumped by the BEFORE-UPDATE trg_award_loyalty_points, which
-- bails early when loyalty is disabled, the earn rate is 0, or points were already awarded — and
-- never fires at all on orders inserted straight as 'delivered' (seed/imported data). So a shop
-- with genuine delivered orders can still have every counter at 0 and an empty board.
--
-- Summing delivered orders' subtotal live is cheap at this scale, always correct, and matches how
-- the tier system defines "spend" (subtotal, ex-delivery). Same signature as before — the RETURNS
-- TABLE shape is unchanged, so create-or-replace keeps the existing grants.

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
  with spend as (
    select o.user_id, sum(o.subtotal_minor)::bigint as spend_minor
    from public."order" o
    where o.status = 'delivered'
    group by o.user_id
  ),
  ranked as (
    select
      u.id as user_id,
      coalesce(nullif(btrim(u.display_name), ''), 'Borteh member') as name,
      u.avatar_path,
      s.spend_minor,
      rank()       over (order by s.spend_minor desc)                   as rnk,
      row_number() over (order by s.spend_minor desc, u.created_at asc) as rn
    from spend s
    join public.app_user u on u.id = s.user_id
    where u.role = 'customer'
      and u.is_blocked = false
      and coalesce(u.show_on_leaderboard, true) = true
      and s.spend_minor > 0
  )
  select rnk, name, spend_minor, avatar_path, (user_id = auth.uid()) as is_me
  from ranked
  where rn <= greatest(p_limit, 1)
     or user_id = auth.uid()
  order by rn;
$$;

revoke all on function public.fn_leaderboard(int) from public;
grant execute on function public.fn_leaderboard(int) to anon, authenticated;

-- Public leaderboard — top customers by lifetime spend, real names, with a per-user opt-out.
-- Owner's explicit product choice (2026-07-07): fully public, real names, ranked by lifetime spend.
-- The whole board is served by a security-definer RPC, so no client ever receives the customer
-- table — only ranked rows (name, spend, rank). Phone numbers and user ids are never returned.

-- ── opt-out: default ON so the board is populated; anyone can quietly step out ────────────────
alter table public.app_user
  add column if not exists show_on_leaderboard boolean not null default true;

-- ── the board ─────────────────────────────────────────────────────────────────────────────────
-- Ranks eligible customers (role=customer, not blocked, opted in, has actually spent). Returns the
-- top p_limit rows PLUS the caller's own row when they rank below the cut, so the screen can always
-- show "You · #34". is_me is computed server-side; other customers' ids never leave the database.
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
      rank()       over (order by la.lifetime_spend_minor desc)                   as rnk,
      row_number() over (order by la.lifetime_spend_minor desc, u.created_at asc) as rn
    from public.loyalty_account la
    join public.app_user u on u.id = la.user_id
    where u.role = 'customer'
      and u.is_blocked = false
      and coalesce(u.show_on_leaderboard, true) = true
      and la.lifetime_spend_minor > 0
  )
  select rnk, name, spend_minor, avatar_path, (user_id = auth.uid()) as is_me
  from ranked
  where rn <= greatest(p_limit, 1)
     or user_id = auth.uid()
  order by rn;
$$;

revoke all on function public.fn_leaderboard(int) from public;
grant execute on function public.fn_leaderboard(int) to anon, authenticated;

-- ── the caller's own visibility (read + set) ───────────────────────────────────────────────────
create or replace function public.fn_leaderboard_visible()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select show_on_leaderboard from public.app_user where id = auth.uid()), true);
$$;

create or replace function public.fn_set_leaderboard_visible(p_show boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.app_user
     set show_on_leaderboard = coalesce(p_show, true), updated_at = now()
   where id = auth.uid();
end;
$$;

revoke all on function public.fn_leaderboard_visible()        from public;
revoke all on function public.fn_set_leaderboard_visible(boolean) from public;
grant execute on function public.fn_leaderboard_visible()        to authenticated;
grant execute on function public.fn_set_leaderboard_visible(boolean) to authenticated;

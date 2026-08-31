-- Bug: fn_award_loyalty_points() computed v_pts = floor(subtotal * points_per_currency_unit)
-- and returned early — skipping the loyalty_account UPDATE entirely — whenever v_pts <= 0.
-- points_per_currency_unit has been 0.0000 in loyalty_config this whole time (no points-per-
-- purchase program configured), so v_pts was always 0 and the early return fired on every
-- single delivered order, for every customer, forever. That early return also skipped
-- lifetime_spend_minor, which has nothing to do with the points-per-currency rate — it's the
-- leaderboard's ranking figure and the tier-progress figure on the Points screen. Confirmed via
-- the live ledger: zero "Earned on order ..." entries exist anywhere in loyalty_ledger, despite
-- real delivered order history, which is why the leaderboard has looked permanently empty.
--
-- Fix: track lifetime_spend_minor on every delivered order unconditionally (still gated on
-- loyalty_enabled, since turning the whole program off is a deliberate broader choice — but
-- never on the points rate specifically). Points themselves stay computed the same way and
-- simply award 0 when the rate is 0, same as before; the ledger entry is now only written when
-- points > 0, so a zero-rate config no longer writes meaningless zero-delta ledger rows.
create or replace function public.fn_award_loyalty_points()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_enabled boolean;
  v_rate numeric;
  v_pts int;
  v_acct_id uuid;
  v_new_balance int;
begin
  if coalesce(new.loyalty_points_earned, 0) > 0 then
    return new; -- already awarded (this order can't re-fire the trigger anyway — see below)
  end if;

  select loyalty_enabled, points_per_currency_unit into v_enabled, v_rate
    from public.loyalty_config limit 1;

  v_pts := 0;
  if coalesce(v_enabled, false) then
    v_pts := floor((new.subtotal_minor::numeric / 100) * coalesce(v_rate, 0));
  end if;

  select id into v_acct_id from public.loyalty_account where user_id = new.user_id;

  if v_acct_id is not null then
    update public.loyalty_account
       set points_balance = points_balance + greatest(v_pts, 0),
           lifetime_points = coalesce(lifetime_points, 0) + greatest(v_pts, 0),
           lifetime_spend_minor = coalesce(lifetime_spend_minor, 0) + new.subtotal_minor,
           updated_at = now()
     where id = v_acct_id
     returning points_balance into v_new_balance;
  else
    v_new_balance := greatest(v_pts, 0);
    insert into public.loyalty_account (user_id, points_balance, lifetime_points, lifetime_spend_minor)
      values (new.user_id, v_new_balance, v_new_balance, new.subtotal_minor)
      returning id into v_acct_id;
  end if;

  if v_pts > 0 then
    insert into public.loyalty_ledger (account_id, user_id, delta, type, order_id, balance_after, reason)
      values (v_acct_id, new.user_id, v_pts, 'earn', new.id, v_new_balance,
              'Earned on order ' || new.order_number);
    new.loyalty_points_earned := v_pts;
  end if;

  return new;
end;
$$;

-- One-time backfill: recompute lifetime_spend_minor for every existing account from the real
-- order history (source of truth), not additively — no account has ever had spend recorded, so
-- a full recompute is safe and correct rather than assuming a partial prior state.
update public.loyalty_account la
set lifetime_spend_minor = coalesce(sub.total, 0),
    updated_at = now()
from (
  select user_id, sum(subtotal_minor) as total
  from public."order"
  where status = 'delivered'
  group by user_id
) sub
where la.user_id = sub.user_id;

-- Customers with delivered orders but no loyalty_account row yet (never earned/redeemed
-- points, so the account was never lazily created) also need one now, or the leaderboard and
-- tier progress still won't see their real spend.
insert into public.loyalty_account (user_id, points_balance, lifetime_points, lifetime_spend_minor)
select o.user_id, 0, 0, sum(o.subtotal_minor)
from public."order" o
left join public.loyalty_account la on la.user_id = o.user_id
where o.status = 'delivered' and la.id is null
group by o.user_id;

-- 20260704090012_award_loyalty_points.sql
-- Auto-award loyalty points the first time an order becomes 'delivered',
-- based on loyalty_config.points_per_currency_unit (points per Le 1) applied to
-- the order subtotal. Idempotent via order.loyalty_points_earned. BEFORE UPDATE
-- so it sets NEW.loyalty_points_earned in-place (no recursion).

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
  v_balance int;
  v_new_balance int;
begin
  if coalesce(new.loyalty_points_earned, 0) > 0 then
    return new; -- already awarded
  end if;

  select loyalty_enabled, points_per_currency_unit into v_enabled, v_rate
    from public.loyalty_config limit 1;
  if not found or not v_enabled then
    return new;
  end if;

  v_pts := floor((new.subtotal_minor::numeric / 100) * coalesce(v_rate, 0));
  if v_pts <= 0 then
    return new;
  end if;

  select id, points_balance into v_acct_id, v_balance
    from public.loyalty_account where user_id = new.user_id;

  if v_acct_id is not null then
    v_new_balance := coalesce(v_balance, 0) + v_pts;
    update public.loyalty_account
       set points_balance = v_new_balance,
           lifetime_points = coalesce(lifetime_points, 0) + v_pts,
           lifetime_spend_minor = coalesce(lifetime_spend_minor, 0) + new.subtotal_minor,
           updated_at = now()
     where id = v_acct_id;
  else
    v_new_balance := v_pts;
    insert into public.loyalty_account (user_id, points_balance, lifetime_points, lifetime_spend_minor)
      values (new.user_id, v_pts, v_pts, new.subtotal_minor)
      returning id into v_acct_id;
  end if;

  insert into public.loyalty_ledger (account_id, user_id, delta, type, order_id, balance_after, reason)
    values (v_acct_id, new.user_id, v_pts, 'earn', new.id, v_new_balance,
            'Earned on order ' || new.order_number);

  new.loyalty_points_earned := v_pts;
  return new;
end;
$$;

drop trigger if exists trg_award_loyalty_points on public."order";
create trigger trg_award_loyalty_points
  before update on public."order"
  for each row
  when (new.status = 'delivered' and old.status is distinct from 'delivered')
  execute function public.fn_award_loyalty_points();

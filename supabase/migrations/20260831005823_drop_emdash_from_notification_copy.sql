-- =====================================================================
-- Voice pass: drop em-dashes from customer-facing notification copy.
-- The em-dash is a reliable "written by AI" tell, and it had crept into the
-- three functions that actually generate push/in-app notification text for
-- customers (order status, restock, referral reward). Rewritten as plain
-- sentences — no wording changes beyond that, and no behavior changes at
-- all (these are CREATE OR REPLACE of the exact same functions).
-- =====================================================================

create or replace function public.fn_notify_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_variant uuid;
  v_name  text;
  v_items text;
  v_lines int;
  v_image text;
  v_title text;
  v_body  text;
begin
  if new.status = old.status then
    return new;
  end if;
  if new.status not in ('confirmed','out_for_delivery','delivered','cancelled') then
    return new; -- 'preparing'/'returned' stay quiet — noise, not news
  end if;

  -- The order's hero item (biggest line): its name drives the copy, its product the thumbnail.
  select count(*) into v_lines from public.order_item where order_id = new.id;
  select oi.variant_id, oi.product_name_snapshot
    into v_variant, v_name
    from public.order_item oi
   where oi.order_id = new.id
   order by oi.line_total_minor desc, oi.product_name_snapshot
   limit 1;
  v_items := coalesce(v_name, 'order')
             || case when v_lines > 1 then ' + ' || (v_lines - 1) || ' more' else '' end;

  -- Prefer an image tagged to that exact variant, else the product's primary/first.
  select pi.storage_path into v_image
    from public.product_variant pv
    join public.product_image pi on pi.product_id = pv.product_id
   where pv.id = v_variant
   order by (pi.variant_id = v_variant) desc nulls last, pi.is_primary desc, pi.sort_order
   limit 1;

  v_title := case new.status
    when 'confirmed'        then 'Your ' || v_items || ' is confirmed'
    when 'out_for_delivery' then v_items || ' is on the way'
    when 'delivered'        then v_items || ' has arrived'
    when 'cancelled'        then 'Your ' || v_items || ' order was cancelled'
  end;

  v_body := case new.status
    when 'confirmed' then
      case when new.delivery_fee_minor is not null
        then 'Delivery fee confirmed. We''ll call before the rider leaves.'
        else 'We''re getting it ready and will confirm the delivery fee by phone.'
      end
    when 'out_for_delivery' then
      case when new.payment_method = 'cash_on_delivery'
        then 'The rider has it. Have the cash ready.'
        else 'The rider has it. See you soon.'
      end
    when 'delivered'        then 'Enjoy. Tell us how it wears in a review.'
    when 'cancelled'        then 'Reach out if that''s unexpected.'
  end || ' · ' || new.order_number;

  insert into public.notification
    (user_id, type, channel, title, body, status, reference_type, reference_id, image_path)
  values
    (new.user_id, 'order_status', 'in_app', v_title, v_body, 'delivered', 'order', new.id, v_image);
  return new;
end;
$$;

create or replace function public.fn_notify_restock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_size int;
  v_image text;
begin
  if not (old.band = 'out' and new.band in ('in_stock','low')) then
    return new;
  end if;

  select p.name, v.size_ml
    into v_name, v_size
    from public.product_variant v
    join public.product p on p.id = v.product_id
   where v.id = new.variant_id;
  if v_name is null then
    return new;
  end if;

  select pi.storage_path into v_image
    from public.product_variant pv
    join public.product_image pi on pi.product_id = pv.product_id
   where pv.id = new.variant_id
   order by (pi.variant_id = new.variant_id) desc nulls last, pi.is_primary desc, pi.sort_order
   limit 1;

  insert into public.notification
    (user_id, type, channel, title, body, status, reference_type, reference_id, image_path)
  select rs.user_id, 'restock_available', 'in_app',
         v_name || ' is back in stock',
         v_size || ' ml is on the shelf again. It went fast last time.',
         'delivered', 'product_variant', new.variant_id, v_image
    from public.restock_subscription rs
   where rs.variant_id = new.variant_id
     and rs.status = 'active';

  update public.restock_subscription
     set status = 'notified', notified_at = now()
   where variant_id = new.variant_id
     and status = 'active';

  return new;
end;
$$;

create or replace function public.fn_reward_referral()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ref     uuid;
  v_pts     int;
  v_enabled boolean;
  v_acct    uuid;
  v_bal     int;
  v_first   text;
begin
  if new.status <> 'delivered' or old.status = 'delivered' then return new; end if;

  select referred_by into v_ref from public.app_user where id = new.user_id;
  if v_ref is null then return new; end if;

  select loyalty_enabled, referral_points into v_enabled, v_pts from public.loyalty_config where id = 1;
  if not coalesce(v_enabled, false) or coalesce(v_pts, 0) <= 0 then return new; end if;

  if exists (select 1 from public.loyalty_ledger
              where user_id = v_ref and reason = 'referral:' || new.user_id) then
    return new; -- already paid for this friend
  end if;

  insert into public.loyalty_account (user_id, points_balance, lifetime_points)
  values (v_ref, v_pts, v_pts)
  on conflict (user_id) do update
    set points_balance  = public.loyalty_account.points_balance + excluded.points_balance,
        lifetime_points = public.loyalty_account.lifetime_points + excluded.lifetime_points
  returning id, points_balance into v_acct, v_bal;

  insert into public.loyalty_ledger (account_id, user_id, delta, type, order_id, balance_after, reason)
  values (v_acct, v_ref, v_pts, 'earn', new.id, v_bal, 'referral:' || new.user_id);

  select split_part(coalesce(display_name, 'Your friend'), ' ', 1) into v_first
    from public.app_user where id = new.user_id;

  insert into public.notification (user_id, type, channel, title, body, status)
  values (v_ref, 'system', 'in_app',
          '+' || v_pts || ' points, thank you',
          v_first || '''s first order arrived. Your referral points are in.',
          'delivered');

  return new;
end;
$$;

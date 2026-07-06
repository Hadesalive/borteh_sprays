-- =====================================================================
-- Loyalty redemption — points become money at checkout, server-side.
--
-- fn_place_order gains p_redeem_points: validated against the live balance
-- and loyalty_config.point_value_minor, capped so points never exceed what's
-- left after the promo discount, deducted atomically with a 'redeem' ledger
-- entry, and stamped on the order (loyalty_redeem_minor). Cancelling an
-- order refunds the exact redeemed points (idempotent).
-- =====================================================================

drop function if exists public.fn_place_order(jsonb, text, text, text, uuid, text, text);

create or replace function public.fn_place_order(
  p_items          jsonb,
  p_landmark       text,
  p_contact_phone  text,
  p_recipient_name text,
  p_zone_id        uuid default null,
  p_notes          text default null,
  p_promo_code     text default null,
  p_redeem_points  int default 0
) returns table(order_id uuid, order_number text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid       uuid := auth.uid();
  v_store     uuid;
  v_loc       uuid;
  v_order     uuid;
  v_number    text;
  v_subtotal  bigint := 0;
  v_promo     uuid;
  v_discount  bigint := 0;
  v_redeem    bigint := 0; -- minor units the points are worth
  v_enabled   boolean;
  v_ptvalue   bigint;
  v_acct      uuid;
  v_balance   int;
  it          jsonb;
  v_variant   uuid;
  v_qty       int;
  v_price     bigint;
  v_pname     text;
  v_label     text;
  v_sku       text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'your bag is empty'; end if;
  if coalesce(btrim(p_landmark), '') = '' then raise exception 'a delivery landmark is required'; end if;
  if coalesce(btrim(p_contact_phone), '') = '' then raise exception 'a contact phone is required'; end if;
  if coalesce(p_redeem_points, 0) < 0 then raise exception 'invalid points'; end if;

  select id into v_store from public.store_location where is_active order by is_default desc, created_at asc limit 1;
  if v_store is null then raise exception 'no store is configured'; end if;

  insert into public.delivery_location (user_id, zone_id, landmark_text, contact_phone, recipient_name)
  values (v_uid, p_zone_id, btrim(p_landmark), btrim(p_contact_phone), nullif(btrim(p_recipient_name), ''))
  returning id into v_loc;

  -- Server-authoritative subtotal from live variant prices.
  for it in select * from jsonb_array_elements(p_items) loop
    v_variant := (it->>'variant_id')::uuid;
    v_qty     := (it->>'qty')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'invalid quantity'; end if;
    select pv.price_minor into v_price
      from public.product_variant pv
     where pv.id = v_variant and pv.is_active and pv.deleted_at is null;
    if v_price is null then raise exception 'a fragrance in your bag is no longer available'; end if;
    v_subtotal := v_subtotal + v_price * v_qty;
  end loop;

  -- Server-authoritative discount — same rules the checkout preview used.
  if coalesce(btrim(p_promo_code), '') <> '' then
    select vp.promo_id, vp.discount_minor into v_promo, v_discount
      from public.fn_validate_promo(p_promo_code, v_subtotal) vp;
    update public.promo_code set usage_count = usage_count + 1 where id = v_promo;
  end if;

  -- Points redemption — balance-checked, value-capped, atomic.
  if coalesce(p_redeem_points, 0) > 0 then
    select loyalty_enabled, point_value_minor into v_enabled, v_ptvalue
      from public.loyalty_config limit 1;
    if not coalesce(v_enabled, false) or coalesce(v_ptvalue, 0) <= 0 then
      raise exception 'redeem_disabled';
    end if;
    select id, points_balance into v_acct, v_balance
      from public.loyalty_account where user_id = v_uid;
    if v_acct is null or coalesce(v_balance, 0) < p_redeem_points then
      raise exception 'insufficient_points';
    end if;
    v_redeem := p_redeem_points::bigint * v_ptvalue;
    if v_redeem > v_subtotal - v_discount then
      raise exception 'redeem_too_much';
    end if;
    update public.loyalty_account
       set points_balance = points_balance - p_redeem_points, updated_at = now()
     where id = v_acct;
  end if;

  insert into public."order" (
    user_id, status, fulfillment_type, payment_method, store_location_id, delivery_location_id, delivery_zone_id,
    landmark_snapshot, contact_phone_snapshot, recipient_name_snapshot,
    subtotal_minor, discount_minor, loyalty_redeem_minor, total_minor, promo_code_id, notes, placed_at
  ) values (
    v_uid, 'confirmed', 'delivery', 'cash_on_delivery', v_store, v_loc, p_zone_id,
    btrim(p_landmark), btrim(p_contact_phone), nullif(btrim(p_recipient_name), ''),
    v_subtotal, v_discount, v_redeem, v_subtotal - v_discount - v_redeem, v_promo, nullif(btrim(p_notes), ''), now()
  ) returning id, order_number into v_order, v_number;

  -- Ledger AFTER the order exists so the entry can reference it.
  if v_redeem > 0 then
    insert into public.loyalty_ledger (account_id, user_id, delta, type, order_id, balance_after, reason)
    select v_acct, v_uid, -p_redeem_points, 'redeem', v_order, points_balance,
           'Redeemed on order ' || v_number
      from public.loyalty_account where id = v_acct;
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (v_order, null, 'confirmed', v_uid, 'Placed — cash on delivery');

  for it in select * from jsonb_array_elements(p_items) loop
    v_variant := (it->>'variant_id')::uuid;
    v_qty     := (it->>'qty')::int;
    select pv.price_minor, pv.sku, (pv.size_ml || ' ml · ' || pv.concentration), p.name
      into v_price, v_sku, v_label, v_pname
      from public.product_variant pv join public.product p on p.id = pv.product_id
     where pv.id = v_variant;

    insert into public.order_item (
      order_id, variant_id, product_name_snapshot, variant_label_snapshot, sku_snapshot,
      unit_price_minor, qty, line_total_minor
    ) values (v_order, v_variant, v_pname, v_label, v_sku, v_price, v_qty, v_price * v_qty);

    if not public.fn_reserve_stock(v_variant, v_qty, v_order, v_uid) then
      raise exception '% is out of stock', v_pname;
    end if;
  end loop;

  order_id := v_order;
  order_number := v_number;
  return next;
end;
$$;

grant execute on function public.fn_place_order(jsonb, text, text, text, uuid, text, text, int) to authenticated;

-- ---------------------------------------------------------------------
-- Cancelled order → the redeemed points come home (idempotent: the
-- refund's reason doubles as the once-only key).
-- ---------------------------------------------------------------------

create or replace function public.fn_refund_redeemed_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pts  int;
  v_acct uuid;
  v_bal  int;
begin
  if new.status <> 'cancelled' or old.status = 'cancelled' then return new; end if;
  if coalesce(new.loyalty_redeem_minor, 0) <= 0 then return new; end if;

  -- exact points from the redeem ledger entry
  select -delta into v_pts from public.loyalty_ledger
   where order_id = new.id and type = 'redeem' limit 1;
  if coalesce(v_pts, 0) <= 0 then return new; end if;

  if exists (select 1 from public.loyalty_ledger
              where order_id = new.id and reason = 'redeem_refund:' || new.id) then
    return new; -- already refunded
  end if;

  update public.loyalty_account
     set points_balance = points_balance + v_pts, updated_at = now()
   where user_id = new.user_id
   returning id, points_balance into v_acct, v_bal;
  if v_acct is null then return new; end if;

  insert into public.loyalty_ledger (account_id, user_id, delta, type, order_id, balance_after, reason)
  values (v_acct, new.user_id, v_pts, 'adjustment', new.id, v_bal, 'redeem_refund:' || new.id);

  return new;
end;
$$;

drop trigger if exists trg_refund_redeemed_points on public."order";
create trigger trg_refund_redeemed_points
  after update of status on public."order"
  for each row execute function public.fn_refund_redeemed_points();

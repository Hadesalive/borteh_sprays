-- =====================================================================
-- fn_place_order: never route a zero-value order through Monime.
--
-- A bag fully covered by combo/tier/promo discounts plus a points redemption
-- comes to total_minor = 0. Until now, picking "Orange Money" on such an order
-- still created a payment_intent for 0 and sent the customer to payment-init,
-- which would POST amount.value = 0 to Monime's /v1/payment-codes — an endpoint
-- that is not documented to accept it and that we have never verified does
-- (open question with Monime support as of 2026-08-29). Best case the customer
-- stares at a USSD code for Le 0; either way the reservation sweep cancels
-- their perfectly valid order 15 minutes later.
--
-- There is no payment to take, so there is nothing for Monime to do: the order
-- is confirmed on the spot, exactly like cash on delivery, and no
-- payment_intent is created. fn_place_order still returns payment_intent_id =
-- NULL, which the mobile checkout already reads as "no USSD step" — the
-- customer lands straight on the confirmed order.
--
-- Everything else in this function is unchanged from
-- 20260828162922_monime_checkout.sql.
-- =====================================================================

create or replace function public.fn_place_order(
  p_items          jsonb,
  p_landmark       text,
  p_contact_phone  text,
  p_recipient_name text,
  p_zone_id        uuid default null,
  p_notes          text default null,
  p_promo_code     text default null,
  p_redeem_points  int default 0,
  p_combos         jsonb default '[]'::jsonb,
  p_payment_method text default 'cash_on_delivery'
) returns table(order_id uuid, order_number text, payment_intent_id uuid)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid        uuid := auth.uid();
  v_store      uuid;
  v_loc        uuid;
  v_order      uuid;
  v_number     text;
  v_subtotal   bigint := 0;
  v_promo      uuid;
  v_promo_disc bigint := 0;
  v_tiers_on   boolean;
  v_tier_pct   numeric;
  v_tier_disc  bigint := 0;
  v_combo_disc bigint := 0; -- total combo-deal saving, folded into discount_minor
  v_discount   bigint := 0; -- combined combo + tier + promo
  v_redeem     bigint := 0; -- minor units the points are worth
  v_enabled    boolean;
  v_ptvalue    bigint;
  v_acct       uuid;
  v_balance    int;
  it           jsonb;
  v_variant    uuid;
  v_qty        int;
  v_price      bigint;
  v_pname      text;
  v_label      text;
  v_sku        text;
  -- combo working state
  v_bag        jsonb := '{}'::jsonb; -- variant_id::text -> remaining qty
  cmb          jsonb;
  v_cid        uuid;
  v_cqty       int;
  v_cprice     bigint;
  v_units      int;
  v_nitems     int;
  v_npriced    int;
  v_combo_sum  bigint;
  v_item       record;
  -- payment method branch
  v_method     text := coalesce(p_payment_method, 'cash_on_delivery');
  v_status     text;
  v_note       text;
  v_intent     uuid;
  v_total      bigint;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'your bag is empty'; end if;
  if coalesce(btrim(p_landmark), '') = '' then raise exception 'a delivery landmark is required'; end if;
  if coalesce(btrim(p_contact_phone), '') = '' then raise exception 'a contact phone is required'; end if;
  if coalesce(p_redeem_points, 0) < 0 then raise exception 'invalid points'; end if;
  if v_method not in ('cash_on_delivery', 'monime') then raise exception 'invalid payment method'; end if;

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

  -- Combo deal discounts — award a pair only when its bottles are in the bag.
  if p_combos is not null and jsonb_typeof(p_combos) = 'array' and jsonb_array_length(p_combos) > 0 then
    -- working copy of the bag: how many of each variant remain unclaimed
    for it in select * from jsonb_array_elements(p_items) loop
      v_variant := (it->>'variant_id')::uuid;
      v_qty     := (it->>'qty')::int;
      v_bag := jsonb_set(v_bag, array[v_variant::text],
                 to_jsonb(coalesce((v_bag->>v_variant::text)::int, 0) + v_qty));
    end loop;

    for cmb in select * from jsonb_array_elements(p_combos) loop
      v_cid  := (cmb->>'combo_id')::uuid;
      v_cqty := coalesce((cmb->>'qty')::int, 0);
      if v_cid is null or v_cqty <= 0 then continue; end if;

      -- must be an active combo with a real deal price set
      select combo_price_minor into v_cprice
        from public.combo
       where id = v_cid and is_active and deleted_at is null and combo_price_minor is not null;
      if v_cprice is null then continue; end if;

      -- whole pairs the bag can back, and one pair's live sum
      select count(*), count(pv.id),
             coalesce(min(floor(coalesce((v_bag->>cit.variant_id::text)::numeric, 0) / cit.qty)), 0)::int,
             coalesce(sum(cit.qty * pv.price_minor), 0)
        into v_nitems, v_npriced, v_units, v_combo_sum
        from public.combo_item cit
        left join public.product_variant pv
          on pv.id = cit.variant_id and pv.is_active and pv.deleted_at is null
       where cit.combo_id = v_cid;

      -- skip malformed / partly-unavailable pairs, and never award a non-deal
      if v_nitems < 2 or v_npriced < v_nitems then continue; end if;
      v_units := least(v_units, v_cqty);
      if v_units <= 0 or v_combo_sum <= v_cprice then continue; end if;

      v_combo_disc := v_combo_disc + (v_combo_sum - v_cprice) * v_units;

      -- consume the backed bottles so they can't fund another pair
      for v_item in select variant_id, qty from public.combo_item where combo_id = v_cid loop
        v_bag := jsonb_set(v_bag, array[v_item.variant_id::text],
                   to_jsonb(coalesce((v_bag->>v_item.variant_id::text)::int, 0) - v_item.qty * v_units));
      end loop;
    end loop;
  end if;

  -- Loyalty-tier discount — automatic once the member qualifies.
  select tiers_enabled into v_tiers_on from public.loyalty_config limit 1;
  if coalesce(v_tiers_on, false) then
    select max(t.discount_percent) into v_tier_pct
      from public.loyalty_tier t
      left join public.loyalty_account la on la.user_id = v_uid
     where t.is_active
       and (t.cumulative_spend_threshold_minor <= coalesce(la.lifetime_spend_minor, 0)
            or t.id = la.current_tier_id);
    v_tier_disc := floor(v_subtotal * coalesce(v_tier_pct, 0) / 100)::bigint;
  end if;

  -- Promo discount — same rules the checkout preview used.
  if coalesce(btrim(p_promo_code), '') <> '' then
    select vp.promo_id, vp.discount_minor into v_promo, v_promo_disc
      from public.fn_validate_promo(p_promo_code, v_subtotal) vp;
    update public.promo_code set usage_count = usage_count + 1 where id = v_promo;
  end if;

  -- Combined discount, capped so it can never exceed the subtotal.
  v_discount := least(v_combo_disc + v_tier_disc + v_promo_disc, v_subtotal);

  -- Points redemption — balance-checked, value-capped by what's left, atomic.
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

  v_total := v_subtotal - v_discount - v_redeem;

  -- Payment-method branch: COD confirms immediately (unchanged); Monime
  -- starts pending — the payment-init Edge Function creates the actual
  -- Monime payment code, the webhook confirms it.
  --
  -- EXCEPT when there is nothing left to charge. A bag fully covered by
  -- combo/tier/promo discounts and points has total 0, and Monime's
  -- /v1/payment-codes is not documented to accept amount.value = 0 (still
  -- unverified with Monime as of 2026-08-29). Routing such an order there
  -- would strand the customer on a "dial this to pay Le 0" screen and then
  -- let the reservation sweep cancel their order 15 minutes later. There is
  -- no payment to take, so confirm it outright — exactly like cash on
  -- delivery — and skip the payment_intent entirely.
  if v_method = 'monime' and v_total > 0 then
    v_status := 'pending_payment';
    v_note   := 'Placed — awaiting Monime payment';
  elsif v_method = 'monime' then
    v_status := 'confirmed';
    v_note   := 'Placed — fully covered by discounts and points, nothing to pay';
  else
    v_status := 'confirmed';
    v_note   := 'Placed — cash on delivery';
  end if;

  insert into public."order" (
    user_id, status, fulfillment_type, payment_method, store_location_id, delivery_location_id, delivery_zone_id,
    landmark_snapshot, contact_phone_snapshot, recipient_name_snapshot,
    subtotal_minor, discount_minor, loyalty_redeem_minor, total_minor, promo_code_id, notes, placed_at
  ) values (
    v_uid, v_status, 'delivery', v_method, v_store, v_loc, p_zone_id,
    btrim(p_landmark), btrim(p_contact_phone), nullif(btrim(p_recipient_name), ''),
    v_subtotal, v_discount, v_redeem, v_total, v_promo, nullif(btrim(p_notes), ''), now()
  ) returning id, order_number into v_order, v_number;

  if v_redeem > 0 then
    insert into public.loyalty_ledger (account_id, user_id, delta, type, order_id, balance_after, reason)
    select v_acct, v_uid, -p_redeem_points, 'redeem', v_order, points_balance,
           'Redeemed on order ' || v_number
      from public.loyalty_account where id = v_acct;
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (v_order, null, v_status, v_uid, v_note);

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

  -- Monime: create the payment_intent HOLD now (in the same transaction as
  -- the reservation above); trg_intent_amount enforces amount_minor ==
  -- order.total_minor. The actual Monime API call happens out-of-transaction
  -- in the payment-init Edge Function, keyed off this row's id, which also
  -- re-anchors reservation_expires_at to the code it mints (see
  -- 20260829115831_ussd_code_expiry.sql).
  if v_method = 'monime' and v_total > 0 then
    insert into public.payment_intent (
      order_id, provider, status, amount_minor, currency, idempotency_key, reservation_expires_at
    ) values (
      v_order, 'monime', 'created', v_total, 'SLE',
      'monime-' || v_order::text, now() + interval '15 minutes'
    ) returning id into v_intent;
  end if;

  order_id := v_order;
  order_number := v_number;
  payment_intent_id := v_intent;
  return next;
end;
$$;

-- 20260621090008_checkout.sql
-- Cash-on-delivery checkout. Customers can't INSERT orders directly (RLS: "insert via
-- service-role checkout"), so order creation goes through a SECURITY DEFINER RPC that
-- validates the caller, prices the basket server-side, writes the order + items, and
-- atomically reserves stock. Delivery fee is left NULL for the owner to confirm (ADR-013).

-- A single default store must exist for orders to reference.
insert into public.store_location (name, code, type, is_default, is_active)
select 'Borteh Sprays — Freetown', 'MAIN', 'retail_store', true, true
where not exists (select 1 from public.store_location);

create or replace function public.fn_place_order(
  p_items          jsonb,        -- [{ "variant_id": uuid, "qty": int }, ...]
  p_landmark       text,
  p_contact_phone  text,
  p_recipient_name text,
  p_zone_id        uuid default null,
  p_notes          text default null
) returns table(order_id uuid, order_number text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid      uuid := auth.uid();
  v_store    uuid;
  v_loc      uuid;
  v_order    uuid;
  v_number   text;
  v_subtotal bigint := 0;
  it         jsonb;
  v_variant  uuid;
  v_qty      int;
  v_price    bigint;
  v_pname    text;
  v_label    text;
  v_sku      text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'your bag is empty'; end if;
  if coalesce(btrim(p_landmark), '') = '' then raise exception 'a delivery landmark is required'; end if;
  if coalesce(btrim(p_contact_phone), '') = '' then raise exception 'a contact phone is required'; end if;

  select id into v_store from public.store_location where is_active order by is_default desc, created_at asc limit 1;
  if v_store is null then raise exception 'no store is configured'; end if;

  -- Persist the drop-off (RLS-owned by the customer); the order also snapshots it.
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

  insert into public."order" (
    user_id, status, fulfillment_type, payment_method, store_location_id, delivery_location_id, delivery_zone_id,
    landmark_snapshot, contact_phone_snapshot, recipient_name_snapshot,
    subtotal_minor, total_minor, notes, placed_at
  ) values (
    v_uid, 'confirmed', 'delivery', 'cash_on_delivery', v_store, v_loc, p_zone_id,
    btrim(p_landmark), btrim(p_contact_phone), nullif(btrim(p_recipient_name), ''),
    v_subtotal, v_subtotal, nullif(btrim(p_notes), ''), now()
  ) returning id, order_number into v_order, v_number;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (v_order, null, 'confirmed', v_uid, 'Placed — cash on delivery');

  -- Line items + stock holds (any shortfall rolls back the whole order).
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

grant execute on function public.fn_place_order(jsonb, text, text, text, uuid, text) to authenticated;

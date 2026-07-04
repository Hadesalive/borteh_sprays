-- 20260622090011_fn_pos_sale.sql
-- Atomic counter (POS) sale: create order + items + move stock in ONE transaction,
-- so the DEFERRABLE INITIALLY DEFERRED subtotal constraint (trg_order_subtotal)
-- sees the items at commit. Admin calls this via the service-role client.
--
-- p_items: jsonb array of {variant_id, name, label, sku, unit_price_minor, qty}

create or replace function public.fn_pos_sale(
  p_user uuid,
  p_store uuid,
  p_payment text,
  p_items jsonb
) returns table(order_id uuid, order_number text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_subtotal bigint := 0;
  it jsonb;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'no items';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_subtotal := v_subtotal + (it->>'unit_price_minor')::bigint * (it->>'qty')::int;
  end loop;

  insert into public."order"(user_id, store_location_id, fulfillment_type, payment_method,
      status, subtotal_minor, total_minor, discount_minor, placed_at, confirmed_at)
    values (p_user, p_store, 'pickup', p_payment,
      'confirmed', v_subtotal, v_subtotal, 0, now(), now())
    returning id, "order".order_number into v_order_id, v_order_number;

  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.order_item(order_id, variant_id, product_name_snapshot,
        variant_label_snapshot, sku_snapshot, unit_price_minor, qty, line_total_minor)
      values (v_order_id, (it->>'variant_id')::uuid, it->>'name',
        coalesce(it->>'label',''), coalesce(it->>'sku',''),
        (it->>'unit_price_minor')::bigint, (it->>'qty')::int,
        (it->>'unit_price_minor')::bigint * (it->>'qty')::int);
    perform public.fn_reserve_stock((it->>'variant_id')::uuid, (it->>'qty')::int, v_order_id, p_user);
    perform public.fn_confirm_sale_online((it->>'variant_id')::uuid, (it->>'qty')::int, v_order_id, p_user);
  end loop;

  return query select v_order_id, v_order_number;
end;
$$;

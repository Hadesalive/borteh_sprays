-- =====================================================================
-- fn_notify_order_status was appending ' · <order_number>' to the body text
-- of every order-status notification. In the notification LIST (not a push
-- banner), that meant the order number rode on the same line as the message
-- sentence, with no room reserved for it, so it wrapped mid-sentence onto
-- its own line — visibly broken, and made every row taller than it needed
-- to be. The number is also redundant there: tapping any of these
-- notifications already opens that exact order, where the number is shown
-- prominently. Dropping the suffix; the reference_id passed to the insert
-- (unchanged) is how the tap-through still finds the right order.
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
  end;

  insert into public.notification
    (user_id, type, channel, title, body, status, reference_type, reference_id, image_path)
  values
    (new.user_id, 'order_status', 'in_app', v_title, v_body, 'delivered', 'order', new.id, v_image);
  return new;
end;
$$;

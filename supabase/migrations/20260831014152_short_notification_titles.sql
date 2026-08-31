-- =====================================================================
-- Root-cause fix for wrapping notification titles, not a font-size patch.
-- The title used to carry the product name ("Your Test Perfume order was
-- cancelled"), so ANY product name long enough — and some genuinely are —
-- would wrap to 2 lines regardless of font size, and would still wrap for a
-- user with a larger accessibility text size even if we shrank it now.
--
-- Apple's own notification titles are short, fixed-length headlines ("Order
-- Shipped"); the specifics live in the body, which already has 2 lines of
-- room. Moving the item name there instead — it never needs to be the
-- title, and a short fixed title can never wrap no matter what the item is
-- called or how large the reader's text size is.
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
  v_items := coalesce(v_name, 'Your order')
             || case when v_lines > 1 then ' + ' || (v_lines - 1) || ' more' else '' end;

  -- Prefer an image tagged to that exact variant, else the product's primary/first.
  select pi.storage_path into v_image
    from public.product_variant pv
    join public.product_image pi on pi.product_id = pv.product_id
   where pv.id = v_variant
   order by (pi.variant_id = v_variant) desc nulls last, pi.is_primary desc, pi.sort_order
   limit 1;

  -- Fixed, short headlines — these can never wrap, whatever the item is called.
  v_title := case new.status
    when 'confirmed'        then 'Order confirmed'
    when 'out_for_delivery' then 'Order on the way'
    when 'delivered'        then 'Order delivered'
    when 'cancelled'        then 'Order cancelled'
  end;

  v_body := case new.status
    when 'confirmed' then
      v_items || case when new.delivery_fee_minor is not null
        then '. We''ll call before the rider leaves.'
        else '. We''re getting it ready and will confirm the delivery fee by phone.'
      end
    when 'out_for_delivery' then
      v_items || case when new.payment_method = 'cash_on_delivery'
        then '. The rider has it. Have the cash ready.'
        else '. The rider has it. See you soon.'
      end
    when 'delivered'        then v_items || '. Enjoy, and tell us how it wears in a review.'
    when 'cancelled'        then v_items || '. Reach out if that''s unexpected.'
  end;

  insert into public.notification
    (user_id, type, channel, title, body, status, reference_type, reference_id, image_path)
  values
    (new.user_id, 'order_status', 'in_app', v_title, v_body, 'delivered', 'order', new.id, v_image);
  return new;
end;
$$;

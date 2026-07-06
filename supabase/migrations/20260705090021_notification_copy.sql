-- =====================================================================
-- Notification copy v2 — lead with WHAT was ordered, not the order number.
-- "Your Khamrah is confirmed" / "Khamrah + 2 more is on the way" beats
-- "Order BO-1049 confirmed": customers remember scents, not numbers. The
-- number still rides at the end of the body for phone-support reference.
--
-- NOTE: the mobile glyph map (components/NotifIcon.tsx) keys off these title
-- keywords: confirmed · on the way · arrived · cancelled. Keep in step.
-- =====================================================================

create or replace function public.fn_notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items text;
  v_lines int;
  v_title text;
  v_body  text;
begin
  if new.status = old.status then
    return new;
  end if;
  if new.status not in ('confirmed','out_for_delivery','delivered','cancelled') then
    return new; -- 'preparing'/'returned' stay quiet — noise, not news
  end if;

  -- The order's hero item (biggest line) + how many companions it has.
  select count(*) into v_lines from public.order_item where order_id = new.id;
  select oi.product_name_snapshot
    into v_items
    from public.order_item oi
   where oi.order_id = new.id
   order by oi.line_total_minor desc, oi.product_name_snapshot
   limit 1;
  v_items := coalesce(v_items, 'order')
             || case when v_lines > 1 then ' + ' || (v_lines - 1) || ' more' else '' end;

  v_title := case new.status
    when 'confirmed'        then 'Your ' || v_items || ' is confirmed'
    when 'out_for_delivery' then v_items || ' is on the way'
    when 'delivered'        then v_items || ' has arrived'
    when 'cancelled'        then 'Your ' || v_items || ' order was cancelled'
  end;

  v_body := case new.status
    when 'confirmed' then
      case when new.delivery_fee_minor is not null
        then 'Delivery fee confirmed — we''ll call before the rider leaves.'
        else 'We''re getting it ready and will confirm the delivery fee by phone.'
      end
    when 'out_for_delivery' then
      case when new.payment_method = 'cash_on_delivery'
        then 'The rider has it — have the cash ready.'
        else 'The rider has it — see you soon.'
      end
    when 'delivered'        then 'Enjoy. Tell us how it wears — leave a review.'
    when 'cancelled'        then 'Reach out if that''s unexpected.'
  end || ' · ' || new.order_number;

  insert into public.notification
    (user_id, type, channel, title, body, status, reference_type, reference_id)
  values
    (new.user_id, 'order_status', 'in_app', v_title, v_body, 'delivered', 'order', new.id);
  return new;
end;
$$;

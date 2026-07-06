-- =====================================================================
-- Notification triggers — the schema (notification, restock_subscription,
-- notification_preference) has existed since 20260616090002 with RLS in
-- ...090004; what was missing is anything that CREATES notifications.
--
-- This migration adds exactly that:
--   · order status changes the customer cares about → inbox row
--   · a subscribed variant coming back in stock → inbox row per active
--     subscriber, subscription flipped to 'notified' (history kept)
--
-- Rows are written channel='in_app', status='delivered' — they are in the
-- inbox the moment they exist. Push delivery (Phase B) will enqueue its own
-- channel='push', status='queued' rows without touching these triggers' shape.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Order status → notification (only statuses a customer acts on;
-- 'preparing'/'returned' stay quiet — noise, not news).
-- ---------------------------------------------------------------------

create or replace function public.fn_notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body  text;
begin
  if new.status = old.status then
    return new;
  end if;

  v_title := case new.status
    when 'confirmed'        then 'Order ' || new.order_number || ' confirmed'
    when 'out_for_delivery' then 'Order ' || new.order_number || ' is on the way'
    when 'delivered'        then 'Order ' || new.order_number || ' delivered'
    when 'cancelled'        then 'Order ' || new.order_number || ' cancelled'
    else null
  end;
  if v_title is null then
    return new;
  end if;

  v_body := case new.status
    when 'confirmed' then
      case when new.delivery_fee_minor is not null
        then 'Delivery fee confirmed — we''ll call before the rider leaves.'
        else 'We''re getting it ready and will confirm your delivery fee by phone.'
      end
    when 'out_for_delivery' then 'Your order is with the rider.'
    when 'delivered'        then 'Enjoy. Leave a review once it settles in.'
    when 'cancelled'        then 'Your order was cancelled — reach out if that''s unexpected.'
  end;

  insert into public.notification
    (user_id, type, channel, title, body, status, reference_type, reference_id)
  values
    (new.user_id, 'order_status', 'in_app', v_title, v_body, 'delivered', 'order', new.id);
  return new;
end;
$$;

drop trigger if exists trg_notify_order_status on public."order";
create trigger trg_notify_order_status
  after update of status on public."order"
  for each row execute function public.fn_notify_order_status();

-- ---------------------------------------------------------------------
-- Variant back in stock → notify active subscribers, flip them to
-- 'notified' (one-shot, history preserved; updated_at handled by the
-- generic touch trigger).
-- ---------------------------------------------------------------------

create or replace function public.fn_notify_restock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_size int;
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

  insert into public.notification
    (user_id, type, channel, title, body, status, reference_type, reference_id)
  select rs.user_id, 'restock_available', 'in_app',
         v_name || ' is back in stock',
         v_size || ' ml is on the shelf again — it went fast last time.',
         'delivered', 'product_variant', new.variant_id
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

drop trigger if exists trg_notify_restock on public.availability_signal;
create trigger trg_notify_restock
  after update of band on public.availability_signal
  for each row execute function public.fn_notify_restock();

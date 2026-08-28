-- =====================================================================
-- Staff-safe cancel for a still-unpaid Monime order.
--
-- The admin's generic order-status button (setOrderStatus) is a blind
-- `UPDATE order SET status = ...` with no side effects — fine for the
-- statuses it's used for elsewhere, but wrong for pending_payment: cancelling
-- an unpaid Monime order that way leaves its stock hold reserved forever
-- (never released) and, worse, the matching "confirm" transition let staff
-- push an order to confirmed with no payment verification at all. Confirm
-- was removed from the admin UI entirely — the webhook is the only path
-- into confirmed. This function is the safe replacement for cancel.
-- =====================================================================
create or replace function public.fn_cancel_pending_monime_order(p_order_id uuid, p_actor uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_item   record;
begin
  select status into v_status from public."order" where id = p_order_id for update;
  if not found then
    return 'not_found';
  end if;
  if v_status <> 'pending_payment' then
    return 'not_pending_payment';
  end if;

  for v_item in select variant_id, qty from public.order_item where order_id = p_order_id and variant_id is not null loop
    begin
      perform public.fn_release_reservation(v_item.variant_id, v_item.qty, p_order_id, p_actor);
    exception when others then
      raise warning 'fn_cancel_pending_monime_order: release skipped for variant % order % (%)', v_item.variant_id, p_order_id, sqlerrm;
    end;
  end loop;

  update public.payment_intent
     set status = 'cancelled', updated_at = now()
   where order_id = p_order_id and status in ('created', 'processing');

  update public."order"
     set status = 'cancelled', cancel_reason = 'staff_cancelled', cancelled_at = now(), updated_at = now()
   where id = p_order_id and status = 'pending_payment';

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order_id, 'pending_payment', 'cancelled', p_actor, 'Cancelled by staff — payment never confirmed');

  return 'cancelled';
end;
$$;

revoke execute on function public.fn_cancel_pending_monime_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_cancel_pending_monime_order(uuid, uuid) to service_role;

-- =====================================================================
-- Customer self-service order cancellation.
--
-- Until now the only cancel path (fn_cancel_pending_monime_order,
-- 20260828194238_admin_cancel_pending_monime.sql) is staff-only — revoked
-- from authenticated/anon entirely. A customer who changes their mind, or
-- picked the wrong item, had no way to back out of their own order.
--
-- Scoped deliberately to `pending_payment` only, matching fn_place_order's
-- own state machine: a cash_on_delivery order is confirmed immediately at
-- placement (no money collected upfront), so pending_payment only ever
-- happens for an unpaid Monime hold in practice. This is the same "nothing
-- has actually been sold or charged yet" state fn_cancel_pending_monime_order
-- already handles for staff — a customer cancelling their own order here
-- carries the same low risk, just gated to the order's own owner instead of
-- staff. A `confirmed` (or later) order — stock genuinely sold, and for
-- Monime, money genuinely collected — is a real refund/support conversation,
-- not a one-tap self-service action, and is intentionally out of scope here.
--
-- Reuses fn_release_reservation exactly like the staff path, and — because
-- fn_confirm_monime_payment's dead-intent detection is purely status-based
-- (`status in ('created','processing')`, not reason-based) — a payment that
-- lands late on a customer-cancelled intent automatically falls into the
-- same late_on_dead_intent refund-queue safety net as a sweep- or
-- staff-cancelled one. No changes needed there.
-- =====================================================================

create or replace function public.fn_cancel_own_order(p_order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_status text;
  v_item   record;
begin
  if v_uid is null then
    return 'unauthenticated';
  end if;

  select status into v_status
    from public."order"
   where id = p_order_id and user_id = v_uid
   for update;

  if not found then
    return 'not_found';
  end if;
  if v_status <> 'pending_payment' then
    return 'not_cancellable';
  end if;

  for v_item in select variant_id, qty from public.order_item where order_id = p_order_id and variant_id is not null loop
    begin
      perform public.fn_release_reservation(v_item.variant_id, v_item.qty, p_order_id, v_uid);
    exception when others then
      raise warning 'fn_cancel_own_order: release skipped for variant % order % (%)', v_item.variant_id, p_order_id, sqlerrm;
    end;
  end loop;

  update public.payment_intent
     set status = 'cancelled', updated_at = now()
   where order_id = p_order_id and status in ('created', 'processing');

  update public."order"
     set status = 'cancelled', cancel_reason = 'customer_cancelled', cancelled_at = now(), updated_at = now()
   where id = p_order_id and status = 'pending_payment';

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order_id, 'pending_payment', 'cancelled', v_uid, 'Cancelled by customer');

  return 'cancelled';
end;
$$;

revoke execute on function public.fn_cancel_own_order(uuid) from public, anon;
grant execute on function public.fn_cancel_own_order(uuid) to authenticated;

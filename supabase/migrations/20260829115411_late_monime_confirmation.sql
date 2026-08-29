-- =====================================================================
-- Late Monime confirmations stop disappearing.
--
-- THE INCIDENT (orders BS-2026-000042/000043, 2026-08-29): a customer dialled
-- their USSD Payment Code more than 15 minutes after placing the order. The
-- pg_cron sweep (fn_expire_monime_intents) had already expired the intent,
-- cancelled the order and released the stock. When Monime's
-- payment_code.completed webhook finally landed, fn_confirm_monime_payment's
-- status-guarded UPDATE matched zero rows and returned 'already_processed' —
-- the SAME value a harmless duplicate delivery returns. Money taken, order
-- cancelled, nobody notified until the customer complained. Verified against
-- Monime's own GET /v1/payment-codes: their record said status "completed"
-- while ours said cancelled.
--
-- Those two cases are not the same thing and must not share a return value:
--   * benign duplicate      -> the intent is already 'succeeded'. Genuinely a
--                              no-op; the order is fine.
--   * late on a dead intent -> the intent is 'expired' (cron sweep) or
--                              'cancelled' (fn_cancel_pending_monime_order,
--                              20260828194238) or 'failed'. The money really
--                              moved and NOTHING on our side will ever fulfil
--                              it unless a human intervenes.
--
-- This migration gives the second case its own return value
-- ('late_on_dead_intent') and files it into public.refund — the existing
-- "money moved, a human must act" queue (20260616090002_schema.sql §8, the
-- same table a dashboard refund review uses). Deliberately NOT a bespoke new
-- alerting mechanism, and deliberately NOT an automatic re-confirmation: the
-- stock was released and may already be sold to someone else, so refund vs.
-- re-place is a staff decision, not something to guess at inside a webhook.
-- =====================================================================

create or replace function public.fn_confirm_monime_payment(
  p_intent_id     uuid,
  p_event_amount  bigint,
  p_event_currency text,
  p_actor         uuid default null
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_order    uuid;
  v_amount   bigint;
  v_currency text;
  v_status   text;
  v_updated  uuid;
  v_flagged  int;
  v_item     record;
begin
  select order_id, amount_minor, currency, status
    into v_order, v_amount, v_currency, v_status
    from public.payment_intent
   where id = p_intent_id
     for update;

  if not found then
    return 'not_found';
  end if;

  if v_amount <> p_event_amount or v_currency <> p_event_currency then
    return 'amount_mismatch';
  end if;

  update public.payment_intent
     set status = 'succeeded', paid_at = now(), updated_at = now()
   where id = p_intent_id
     and amount_minor = p_event_amount
     and currency = p_event_currency
     and status in ('created', 'processing')
   returning order_id into v_updated;

  -- Nothing flipped. v_status was read under this same row lock, so it tells
  -- us WHICH of the two cases this is.
  if v_updated is null then
    if v_status = 'succeeded' then
      return 'already_processed';   -- benign duplicate delivery; the order is fine
    end if;

    -- 'expired' / 'cancelled' / 'failed': the customer paid for an order we
    -- already killed. Record when the money actually landed and why the intent
    -- looks the way it does, so reconciliation has a timestamp to work from.
    update public.payment_intent
       set paid_at = coalesce(paid_at, now()),
           failure_reason = 'late_confirmation_after_' || v_status,
           updated_at = now()
     where id = p_intent_id;

    -- One refund-queue row per intent — webhook retries must not pile up
    -- duplicates. reason is a stable machine-readable key; notes is what the
    -- staff member actually reads.
    insert into public.refund (order_id, payment_intent_id, amount_minor, currency, status, reason, notes)
    select v_order, p_intent_id, p_event_amount, p_event_currency, 'pending',
           'late_monime_confirmation',
           'Monime confirmed this payment AFTER the payment intent was already ' || v_status ||
           '. The customer paid, but the order was cancelled and its stock released. ' ||
           'Refund the customer, or re-place the order if the stock is still available.'
     -- refund.amount_minor is CHECK (> 0); a zero-value event would abort the
     -- whole webhook transaction and put Monime into a pointless retry loop.
     where p_event_amount > 0
       and not exists (
         select 1 from public.refund r
          where r.payment_intent_id = p_intent_id
            and r.reason = 'late_monime_confirmation'
       );
    get diagnostics v_flagged = row_count;

    -- Only note it on the order the first time; a redelivered event must not
    -- pile identical rows into the status timeline.
    if v_flagged > 0 then
      insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
      select v_order, o.status, o.status, p_actor,
             'Monime payment confirmed after the intent was ' || v_status ||
             ' — flagged for refund review'
        from public."order" o
       where o.id = v_order;
    end if;

    raise warning 'fn_confirm_monime_payment: LATE confirmation on % intent % (order %) — flagged for refund review',
      v_status, p_intent_id, v_order;
    return 'late_on_dead_intent';
  end if;

  for v_item in select variant_id, qty from public.order_item where order_id = v_updated and variant_id is not null loop
    begin
      perform public.fn_confirm_sale_online(v_item.variant_id, v_item.qty, v_updated, p_actor);
    exception when others then
      raise warning 'fn_confirm_monime_payment: stock confirm skipped for variant % order % (%)', v_item.variant_id, v_updated, sqlerrm;
    end;
  end loop;

  update public."order"
     set status = 'confirmed', confirmed_at = now(), updated_at = now()
   where id = v_updated and status = 'pending_payment';

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (v_updated, 'pending_payment', 'confirmed', p_actor, 'Monime payment confirmed');

  return 'confirmed';
end;
$$;

revoke execute on function public.fn_confirm_monime_payment(uuid, bigint, text, uuid) from public, anon, authenticated;
grant  execute on function public.fn_confirm_monime_payment(uuid, bigint, text, uuid) to service_role;

-- ---- the surface a human actually looks at ------------------------------
-- Everything in the refund queue that still needs a decision, joined to the
-- order/intent context a staff member needs to make one. security_invoker so
-- the refund table's rf_staff RLS policy still applies (same pattern as the
-- other admin_* views, 20260712204042_admin_stat_views.sql).
create or replace view public.admin_payment_attention as
select
  r.id                as refund_id,
  r.order_id,
  o.order_number,
  o.status            as order_status,
  r.payment_intent_id,
  pi.status           as intent_status,
  pi.provider_intent_id,
  pi.paid_at,
  r.amount_minor,
  r.currency,
  r.status            as refund_status,
  r.reason,
  r.notes,
  r.requested_at
from public.refund r
join public."order" o on o.id = r.order_id
left join public.payment_intent pi on pi.id = r.payment_intent_id
where r.status in ('pending', 'manual_processing');

alter view public.admin_payment_attention set (security_invoker = on);
grant select on public.admin_payment_attention to authenticated, service_role;

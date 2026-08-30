-- =====================================================================
-- Tell a human when a late Monime payment lands.
--
-- 20260829115411 made a late confirmation *recordable*: it files a
-- public.refund row that surfaces in admin_payment_attention. That closed the
-- silent-data-loss half of the 2026-08-29 incident, and it was verified
-- end-to-end through the live webhook.
--
-- It did NOT close the operational half. The refund row paints a banner on the
-- admin Orders page and waits. If a late payment lands at 02:00 it sits there
-- until somebody happens to log in — while the customer has already paid and is
-- looking at an order marked cancelled. The whole point of the fix was that this
-- case stops being something a person has to stumble upon.
--
-- So the same guarded branch now also writes to public.notification, which the
-- existing trg_push_notification mirrors to the device via Expo (20260705090018):
--
--   * every staff/owner account gets a 'system' notice naming the order and
--     amount, so it reaches a lock screen rather than a dashboard nobody has
--     open;
--   * the customer gets an 'order_status' notice acknowledging the payment was
--     seen. Deliberately non-committal on the outcome — staff decide between a
--     refund and re-placing the order, and the copy must not promise either.
--
-- Both are inside the existing `v_flagged > 0` guard, so a redelivered webhook
-- cannot spam anyone: one payment, one alert. Notification failures are trapped
-- and logged, never fatal — the refund row is the durable record and must not be
-- rolled back because a push hiccuped.
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
  v_number   text;
  v_buyer    uuid;
  v_money    text;
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
    -- pile identical rows into the status timeline, or alert anyone twice.
    if v_flagged > 0 then
      insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
      select v_order, o.status, o.status, p_actor,
             'Monime payment confirmed after the intent was ' || v_status ||
             ' — flagged for refund review'
        from public."order" o
       where o.id = v_order;

      select o.order_number, o.user_id into v_number, v_buyer
        from public."order" o where o.id = v_order;
      v_money := 'Le ' || to_char(p_event_amount / 100.0, 'FM999G999G990D00');

      -- Reaching a human is best-effort by design: the refund row above is the
      -- durable record, and a push outage must never roll it back.
      begin
        insert into public.notification (user_id, type, channel, title, body, reference_type, reference_id, status)
        select u.id, 'system', 'in_app',
               'Payment received on a cancelled order',
               v_money || ' came through for ' || coalesce(v_number, 'an order') ||
               ', but it was already cancelled and the stock released. Refund the customer, or re-place the order.',
               'order', v_order, 'delivered'
          from public.app_user u
         where u.role in ('staff', 'owner');
      exception when others then
        raise warning 'fn_confirm_monime_payment: staff alert failed for order % (%)', v_order, sqlerrm;
      end;

      -- The customer paid and is staring at a cancelled order. Acknowledge it.
      -- Deliberately promises nothing: refund vs re-place is a staff decision.
      if v_buyer is not null then
        begin
          insert into public.notification (user_id, type, channel, title, body, reference_type, reference_id, status)
          values (v_buyer, 'order_status', 'in_app',
                  'We received your payment',
                  'Your payment of ' || v_money || ' for ' || coalesce(v_number, 'your order') ||
                  ' arrived after the order had been cancelled. We''re sorting it out and will contact you shortly.',
                  'order', v_order, 'delivered');
        exception when others then
          raise warning 'fn_confirm_monime_payment: customer notice failed for order % (%)', v_order, sqlerrm;
        end;
      end if;
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

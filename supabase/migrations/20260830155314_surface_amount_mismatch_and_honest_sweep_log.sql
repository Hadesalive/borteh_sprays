-- =====================================================================
-- Two defects found by investigating a real 2026-08-28 order (BS-2026-000035).
--
-- (1) AN AMOUNT MISMATCH TAKES THE MONEY AND TELLS NOBODY.
-- That order was Le 0.95; Monime reported a completed payment of Le 1.00. The
-- amount guard correctly refused to confirm on a figure that did not match — that
-- part worked. But the branch then returned and did nothing else: no refund-queue
-- row, no alert, and a payment_webhook row left processed=false forever. Monime's
-- retry hits the event-id dedup and 200s, so even the 500 stops after one
-- delivery. The customer's money moved and the only trace is a column nobody
-- queries. It is the same silent-loss shape as the late-confirmation incident,
-- and unlike that one it had already happened for real.
--
-- A verified signature means Monime is telling us a genuine payment completed —
-- for the wrong amount. Whether that is an over-payment, a partial payment or a
-- misconfiguration is a human's call, so it now goes to the same refund queue and
-- the same push alert as the other two money-moved-without-fulfilment cases.
-- The order is still NOT confirmed: refusing to fulfil on an amount we did not
-- agree to is the correct behaviour and is unchanged.
--
-- Note the amount recorded is what the customer ACTUALLY paid (the event amount),
-- not the order total — which is also why this needs the cap-proofing from
-- 20260830120159: an over-payment exceeds the order total by definition, so
-- trg_refund_cap will often refuse the row. Staff are alerted either way.
--
-- (2) THE EXPIRY SWEEP LOGGED CANCELLATIONS THAT NEVER HAPPENED.
-- fn_expire_monime_intents guards its order UPDATE with status='pending_payment'
-- but wrote the order_status_history row unconditionally. When the UPDATE matched
-- nothing — as on BS-2026-000035, already confirmed by hand — the sweep still
-- logged "Monime payment expired — stock released". The order remained confirmed
-- while its own timeline claimed it was cancelled. An audit trail that lies is
-- worse than none: it is what makes an incident hard to reconstruct afterwards,
-- and it cost real time when reconstructing this one. The history row now only
-- writes when the order actually moved.
-- =====================================================================

create or replace function public.fn_confirm_monime_payment(
  p_intent_id      uuid,
  p_event_amount   bigint,
  p_event_currency text,
  p_actor          uuid default null,
  p_provider_ref   text default null
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_order    uuid;
  v_queued   boolean := false;
  v_amount   bigint;
  v_currency text;
  v_status   text;
  v_paid_ref text;
  v_updated  uuid;
  v_item     record;
  v_number   text;
  v_buyer    uuid;
  v_money    text;
  v_tag      text;
begin
  select order_id, amount_minor, currency, status, paid_provider_ref
    into v_order, v_amount, v_currency, v_status, v_paid_ref
    from public.payment_intent
   where id = p_intent_id
     for update;

  if not found then
    return 'not_found';
  end if;

  -- ---- amount / currency disagreement -------------------------------------
  -- Do NOT confirm: we only fulfil on the figure we agreed. But money moved, so
  -- it must reach a human rather than dying in a column.
  if v_amount <> p_event_amount or v_currency <> p_event_currency then
    v_money := 'Le ' || to_char(p_event_amount / 100.0, 'FM999G999G990D00');
    v_tag   := 'amount mismatch (' || p_event_amount || ' ' || p_event_currency || ')';

    if not exists (
      select 1 from public.order_status_history h
       where h.order_id = v_order and h.note like '%' || v_tag || '%'
    ) then
      insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
      select v_order, o.status, o.status, p_actor,
             'Monime reported a completed payment with ' || v_tag ||
             ' against an intent for ' || v_amount || ' ' || v_currency || ' — not confirmed, flagged for review'
        from public."order" o where o.id = v_order;

      -- Over-payments exceed the order total by definition, so trg_refund_cap
      -- will often refuse this. Never let that abort the webhook.
      begin
        insert into public.refund (order_id, payment_intent_id, amount_minor, currency, status, reason, notes)
        select v_order, p_intent_id, p_event_amount, p_event_currency, 'pending',
               'monime_amount_mismatch',
               'Monime reported a COMPLETED payment of ' || p_event_amount || ' ' || p_event_currency ||
               ', but this order expects ' || v_amount || ' ' || v_currency ||
               '. The order was deliberately NOT confirmed. Check Monime, then either refund the ' ||
               'customer or correct and fulfil the order manually.'
         where p_event_amount > 0;
        v_queued := true;
      exception when others then
        v_queued := false;
        raise warning 'fn_confirm_monime_payment: mismatch refund row rejected for order % (%) — alerting anyway', v_order, sqlerrm;
      end;

      select o.order_number, o.user_id into v_number, v_buyer
        from public."order" o where o.id = v_order;

      begin
        insert into public.notification (user_id, type, channel, title, body, reference_type, reference_id, status)
        select u.id, 'system', 'in_app',
               'Payment for the wrong amount',
               coalesce(v_number, 'An order') || ': Monime reported ' || v_money || ' paid, but the order is Le ' ||
               to_char(v_amount / 100.0, 'FM999G999G990D00') ||
               '. It has NOT been confirmed. ' ||
               case when v_queued then 'Queued for review.'
                    else 'It could not be queued (it would exceed the order total) — handle manually.' end,
               'order', v_order, 'delivered'
          from public.app_user u
         where u.role in ('staff', 'owner');
      exception when others then
        raise warning 'fn_confirm_monime_payment: mismatch staff alert failed for order % (%)', v_order, sqlerrm;
      end;
    end if;

    raise warning 'fn_confirm_monime_payment: AMOUNT MISMATCH on intent % (order %) — event % %, expected % %',
      p_intent_id, v_order, p_event_amount, p_event_currency, v_amount, v_currency;
    return 'amount_mismatch';
  end if;

  update public.payment_intent
     set status = 'succeeded',
         paid_at = now(),
         paid_provider_ref = coalesce(p_provider_ref, paid_provider_ref),
         updated_at = now()
   where id = p_intent_id
     and amount_minor = p_event_amount
     and currency = p_event_currency
     and status in ('created', 'processing')
   returning order_id into v_updated;

  if v_updated is null then
    if v_status = 'succeeded' then
      if p_provider_ref is null or v_paid_ref is null or p_provider_ref = v_paid_ref then
        return 'already_processed';
      end if;

      if not exists (
        select 1 from public.order_status_history h
         where h.order_id = v_order and h.note like '%' || p_provider_ref || '%'
      ) then
        insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
        select v_order, o.status, o.status, p_actor,
               'Second Monime payment received on code ' || p_provider_ref || ' — flagged for refund'
          from public."order" o where o.id = v_order;

        begin
          insert into public.refund (order_id, payment_intent_id, amount_minor, currency, status, reason, notes)
          values (v_order, p_intent_id, p_event_amount, p_event_currency, 'pending',
                  'duplicate_monime_payment',
                  'This order was paid TWICE. It was confirmed by payment code ' || v_paid_ref ||
                  ', and a second payment arrived on code ' || p_provider_ref ||
                  '. The order is already fulfilled against the first — refund the second.');
          v_queued := true;
        exception when others then
          v_queued := false;
          raise warning 'fn_confirm_monime_payment: duplicate refund row rejected for order % (%) — alerting anyway', v_order, sqlerrm;
        end;

        select o.order_number, o.user_id into v_number, v_buyer
          from public."order" o where o.id = v_order;
        v_money := 'Le ' || to_char(p_event_amount / 100.0, 'FM999G999G990D00');

        begin
          insert into public.notification (user_id, type, channel, title, body, reference_type, reference_id, status)
          select u.id, 'system', 'in_app',
                 'Order paid twice',
                 coalesce(v_number, 'An order') || ' was paid a second time (' || v_money || '). ' ||
                 case when v_queued
                      then 'It is already fulfilled against the first payment — refund the duplicate.'
                      else 'It could not be added to the refund queue (it would exceed the order total) — handle this one manually.'
                 end,
                 'order', v_order, 'delivered'
            from public.app_user u
           where u.role in ('staff', 'owner');
        exception when others then
          raise warning 'fn_confirm_monime_payment: duplicate-payment staff alert failed for order % (%)', v_order, sqlerrm;
        end;

        if v_buyer is not null then
          begin
            insert into public.notification (user_id, type, channel, title, body, reference_type, reference_id, status)
            values (v_buyer, 'order_status', 'in_app',
                    'You were charged twice',
                    'We received a second payment of ' || v_money || ' for ' ||
                    coalesce(v_number, 'your order') || '. Your order is safe, and we''re refunding the extra.',
                    'order', v_order, 'delivered');
          exception when others then
            raise warning 'fn_confirm_monime_payment: duplicate-payment customer notice failed for order % (%)', v_order, sqlerrm;
          end;
        end if;
      end if;

      raise warning 'fn_confirm_monime_payment: DUPLICATE payment on intent % (order %) — confirmed by %, second on %',
        p_intent_id, v_order, v_paid_ref, p_provider_ref;
      return 'duplicate_payment';
    end if;

    update public.payment_intent
       set paid_at = coalesce(paid_at, now()),
           failure_reason = 'late_confirmation_after_' || v_status,
           updated_at = now()
     where id = p_intent_id;

    if not exists (
      select 1 from public.order_status_history h
       where h.order_id = v_order and h.note like '%flagged for refund review%'
    ) then
      begin
        insert into public.refund (order_id, payment_intent_id, amount_minor, currency, status, reason, notes)
        select v_order, p_intent_id, p_event_amount, p_event_currency, 'pending',
               'late_monime_confirmation',
               'Monime confirmed this payment AFTER the payment intent was already ' || v_status ||
               '. The customer paid, but the order was cancelled and its stock released. ' ||
               'Refund the customer, or re-place the order if the stock is still available.'
         where p_event_amount > 0;
        v_queued := true;
      exception when others then
        v_queued := false;
        raise warning 'fn_confirm_monime_payment: late refund row rejected for order % (%) — alerting anyway', v_order, sqlerrm;
      end;

      insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
      select v_order, o.status, o.status, p_actor,
             'Monime payment confirmed after the intent was ' || v_status ||
             ' — flagged for refund review'
        from public."order" o
       where o.id = v_order;

      select o.order_number, o.user_id into v_number, v_buyer
        from public."order" o where o.id = v_order;
      v_money := 'Le ' || to_char(p_event_amount / 100.0, 'FM999G999G990D00');

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

revoke execute on function public.fn_confirm_monime_payment(uuid, bigint, text, uuid, text) from public, anon, authenticated;
grant  execute on function public.fn_confirm_monime_payment(uuid, bigint, text, uuid, text) to service_role;


-- ---- (2) the sweep stops logging cancellations it did not perform ----------
create or replace function public.fn_expire_monime_intents()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_intent    record;
  v_item      record;
  v_count     int := 0;
  v_cancelled uuid;
begin
  for v_intent in
    select id, order_id
      from public.payment_intent
     where provider = 'monime'
       and status in ('created', 'processing')
       and reservation_expires_at < now()
     for update skip locked
  loop
    for v_item in select variant_id, qty from public.order_item where order_id = v_intent.order_id and variant_id is not null loop
      begin
        perform public.fn_release_reservation(v_item.variant_id, v_item.qty, v_intent.order_id, null);
      exception when others then
        raise warning 'fn_expire_monime_intents: release skipped for variant % order % (%)', v_item.variant_id, v_intent.order_id, sqlerrm;
      end;
    end loop;

    update public.payment_intent
       set status = 'expired', updated_at = now()
     where id = v_intent.id and status in ('created', 'processing');

    update public."order"
       set status = 'cancelled', cancel_reason = 'payment_expired', cancelled_at = now(), updated_at = now()
     where id = v_intent.order_id and status = 'pending_payment'
   returning id into v_cancelled;

    -- Only log a cancellation that actually happened. The UPDATE above is
    -- guarded on pending_payment, so an order confirmed by other means is left
    -- alone — but the history row used to be written regardless, leaving orders
    -- whose own timeline claimed they were cancelled while they were confirmed.
    if v_cancelled is not null then
      insert into public.order_status_history (order_id, from_status, to_status, note)
      values (v_intent.order_id, 'pending_payment', 'cancelled', 'Monime payment expired — stock released');
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.fn_expire_monime_intents() from public, anon, authenticated;
grant  execute on function public.fn_expire_monime_intents() to service_role;

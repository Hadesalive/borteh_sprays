-- =====================================================================
-- Never let a refund-queue insert take the webhook down.
--
-- 20260830115752 added duplicate-payment detection, and testing it against the
-- live schema turned up a sharp edge that applies to BOTH flag paths:
-- trg_refund_cap (20260616090003) rejects any refund that would push the order's
-- total refunds past order.total_minor. That is the right rule for ordinary
-- refunds and the wrong one here — on a duplicate the customer paid twice the
-- total and is owed the excess, which the cap does not model. It also fires on a
-- late confirmation for an order that already carries refunds at the cap.
--
-- Unhandled, that exception aborts the whole webhook transaction: Monime gets a
-- 500, redelivers forever, and the event is never recorded. The failure mode is
-- strictly worse than the problem the flagging exists to solve.
--
-- So both branches now:
--   * dedup on public.order_status_history rather than on the refund row, since
--     the history row always writes while the refund row may be refused;
--   * wrap the refund insert in its own handler, and
--   * alert staff either way — when the queue row was refused, the alert says so
--     explicitly, because it is then the only trace anyone will get.
--
-- Whether trg_refund_cap should measure against money actually received rather
-- than order total is a real question, but it is a business-rule change with a
-- wider blast radius and is deliberately left alone here.
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
  v_flagged  int;
  v_item     record;
  v_number   text;
  v_buyer    uuid;
  v_money    text;
begin
  select order_id, amount_minor, currency, status, paid_provider_ref
    into v_order, v_amount, v_currency, v_status, v_paid_ref
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
    -- Already succeeded: redelivery, or a second payment we must not swallow.
    if v_status = 'succeeded' then
      if p_provider_ref is null or v_paid_ref is null or p_provider_ref = v_paid_ref then
        return 'already_processed';   -- same code, or not enough information to judge
      end if;

      select o.order_number, o.user_id into v_number, v_buyer
        from public."order" o where o.id = v_order;
      v_money := 'Le ' || to_char(p_event_amount / 100.0, 'FM999G999G990D00');

      -- Dedup on the STATUS HISTORY, not on the refund row. trg_refund_cap caps
      -- total refunds at the order total, so on a duplicate the queue row can be
      -- legitimately rejected (the customer paid 2x the total and is owed the
      -- excess, which the cap does not model). Anchoring dedup to the refund row
      -- would then re-alert on every redelivery. The history row always writes.
      if not exists (
        select 1 from public.order_status_history h
         where h.order_id = v_order and h.note like '%' || p_provider_ref || '%'
      ) then
        insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
        select v_order, o.status, o.status, p_actor,
               'Second Monime payment received on code ' || p_provider_ref || ' — flagged for refund'
          from public."order" o where o.id = v_order;

        -- Best effort: may hit trg_refund_cap. Must never abort the webhook —
        -- a 500 here would have Monime redeliver forever and still record nothing.
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

        -- Staff are told either way; when the queue row could not be written the
        -- alert says so, because that is the only trace they will get.
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

    -- 'expired' / 'cancelled' / 'failed': the customer paid for an order we
    -- already killed. Record when the money actually landed and why the intent
    -- looks the way it does, so reconciliation has a timestamp to work from.
    update public.payment_intent
       set paid_at = coalesce(paid_at, now()),
           failure_reason = 'late_confirmation_after_' || v_status,
           updated_at = now()
     where id = p_intent_id;

    -- Same cap-proofing as the duplicate branch: dedup on the status history so a
    -- refund row rejected by trg_refund_cap cannot cause repeat alerting, and
    -- never let the insert abort the webhook.
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

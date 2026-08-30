-- =====================================================================
-- Tell a SECOND REAL PAYMENT apart from a redelivered webhook.
--
-- Until now, anything arriving on an already-succeeded intent returned
-- 'already_processed'. That is right for a redelivery — Monime resends the same
-- event and there is nothing to do. It is badly wrong for a genuine second
-- payment: the customer has been charged twice, there is one order, and the
-- extra money disappears with no record and no alert. It is the same silent-loss
-- shape as the 2026-08-29 incident, one layer along.
--
-- It takes two live codes to reach, which takes a retry — and the retry button
-- only started working on 2026-08-30 (20260829115831 + the momo_provider fix).
-- So this went from unreachable to reachable the moment "Get a new code" began
-- minting fresh codes. The exposure is narrow (an old code paid inside the
-- 60s freshness margin, before its replacement supersedes it) but it is real.
--
-- HOW WE TELL THEM APART
-- payment_intent.provider_intent_id is the LAST code minted, not the one that
-- was paid — a retry overwrites it — so it cannot answer this. The new
-- paid_provider_ref records which payment code actually confirmed the intent.
-- A later completion is then:
--   * the same ref  -> redelivery. 'already_processed', as before.
--   * a DIFFERENT ref -> a second distinct payment. Flag it.
--   * ref unknown on either side -> fall back to 'already_processed'.
--     Deliberately conservative: a missed duplicate is recoverable from Monime's
--     own records, a false duplicate would have staff refunding money that was
--     never taken twice.
--
-- The caller must pass the PAYMENT CODE id, not the raw event object id. The
-- same payment emits payment_code.completed (object.id = pmc-...) and
-- payment.processing_completed (object.id = spm-..., the code id living at
-- data.ownershipGraph.owner.id). Comparing raw object ids would flag every
-- normal payment as a duplicate — see paymentCodeRef() in the webhook.
--
-- NOT BACKFILLED. Intents that succeeded before this migration keep a null
-- paid_provider_ref and therefore keep the old conservative behaviour. Filling
-- it from provider_intent_id would be a guess, and a wrong guess here costs real
-- money.
-- =====================================================================

alter table public.payment_intent add column if not exists paid_provider_ref text;

comment on column public.payment_intent.paid_provider_ref is
  'Monime payment-code id (pmc-...) that actually confirmed this intent. Distinguishes a redelivered webhook from a genuine second payment. NULL on intents confirmed before 2026-08-30.';

-- the signature changes, so replace rather than overload
drop function if exists public.fn_confirm_monime_payment(uuid, bigint, text, uuid);

create or replace function public.fn_confirm_monime_payment(
  p_intent_id      uuid,
  p_event_amount   bigint,
  p_event_currency text,
  p_actor          uuid default null,
  p_provider_ref   text default null
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_order    uuid;
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

      -- One queue row per extra payment code, so a redelivery of the DUPLICATE
      -- cannot pile up either.
      insert into public.refund (order_id, payment_intent_id, amount_minor, currency, status, reason, notes)
      select v_order, p_intent_id, p_event_amount, p_event_currency, 'pending',
             'duplicate_monime_payment',
             'This order was paid TWICE. It was confirmed by payment code ' || v_paid_ref ||
             ', and a second payment arrived on code ' || p_provider_ref ||
             '. The order is already fulfilled against the first — refund the second.'
       where p_event_amount > 0
         and not exists (
           select 1 from public.refund r
            where r.payment_intent_id = p_intent_id
              and r.reason = 'duplicate_monime_payment'
              and r.notes like '%' || p_provider_ref || '%'
         );
      get diagnostics v_flagged = row_count;

      if v_flagged > 0 then
        insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
        select v_order, o.status, o.status, p_actor,
               'Second Monime payment received on code ' || p_provider_ref || ' — flagged for refund'
          from public."order" o where o.id = v_order;

        begin
          insert into public.notification (user_id, type, channel, title, body, reference_type, reference_id, status)
          select u.id, 'system', 'in_app',
                 'Order paid twice',
                 coalesce(v_number, 'An order') || ' was paid a second time (' || v_money ||
                 '). It is already fulfilled against the first payment — refund the duplicate.',
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

    insert into public.refund (order_id, payment_intent_id, amount_minor, currency, status, reason, notes)
    select v_order, p_intent_id, p_event_amount, p_event_currency, 'pending',
           'late_monime_confirmation',
           'Monime confirmed this payment AFTER the payment intent was already ' || v_status ||
           '. The customer paid, but the order was cancelled and its stock released. ' ||
           'Refund the customer, or re-place the order if the stock is still available.'
     where p_event_amount > 0
       and not exists (
         select 1 from public.refund r
          where r.payment_intent_id = p_intent_id
            and r.reason = 'late_monime_confirmation'
       );
    get diagnostics v_flagged = row_count;

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

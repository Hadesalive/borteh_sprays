-- =====================================================================
-- The refund cap measures money RECEIVED, not the order total.
--
-- trg_refund_cap refused any refund pushing an order's refunds past
-- order.total_minor. That is a good approximation right up until the moment it
-- matters: the two cases where we hold more of a customer's money than the order
-- was worth are exactly the ones it blocks.
--   * paid twice  -> we hold 2x the total, the second is fully refundable;
--   * over-paid   -> Le 1.00 against a Le 0.95 order (this really happened,
--                    BS-2026-000035) -> the refund row was refused outright.
-- It is also wrong in the other direction: on an UNDER-payment it would happily
-- authorise refunding the full order total when we only ever took part of it.
--
-- Fixing it needs something the schema did not have: a record of money actually
-- received. COD already had one (delivery_job.cod_collected_minor); card/mobile
-- money had none — a succeeded payment_intent says an amount was *expected*, and
-- says nothing at all about a duplicate or a mismatched payment.
--
-- public.payment_receipt is that ledger. fn_confirm_monime_payment writes one at
-- every point money demonstrably moved — confirmed, duplicate, wrong amount, and
-- late-after-cancellation — keyed on the Monime payment-code id so a redelivered
-- webhook cannot inflate it. The cap then reads receipts + cash collected, and
-- falls back to order.total_minor only when neither exists, so COD and every
-- pre-existing order behave exactly as they do today.
--
-- Worth stating plainly: this RAISES the ceiling on what staff can refund for an
-- order that was genuinely overpaid. That is the point. It never authorises
-- refunding money we did not take — the ledger only grows on evidence from a
-- signature-verified webhook.
-- =====================================================================

create table if not exists public.payment_receipt (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public."order"(id) on delete cascade,
  payment_intent_id uuid references public.payment_intent(id) on delete set null,
  provider          text not null default 'monime',
  provider_ref      text not null,               -- Monime payment-code id (pmc-...)
  amount_minor      bigint not null check (amount_minor > 0),
  currency          char(3) not null default 'SLE',
  received_at       timestamptz not null default now(),
  constraint uq_receipt_provider_ref unique (provider, provider_ref)
);
create index if not exists idx_receipt_order on public.payment_receipt (order_id);

comment on table public.payment_receipt is
  'Money actually received per order, one row per distinct provider payment. Keyed on the provider payment id so a redelivered webhook cannot double-count. Read by fn_assert_refund_cap; a succeeded payment_intent records what was EXPECTED, this records what arrived.';

alter table public.payment_receipt enable row level security;
create policy pr_own   on public.payment_receipt for select to authenticated using (
  exists (select 1 from public."order" o where o.id = order_id and o.user_id = auth.uid()));
create policy pr_staff on public.payment_receipt for select to authenticated using (public.is_staff());

-- ---- the writer -----------------------------------------------------------
-- Idempotent on (provider, provider_ref). A null ref means we could not identify
-- the payment, so nothing is recorded rather than risking a double count — the
-- cap then falls back as it always did.
create or replace function public.fn_record_monime_receipt(
  p_order_id  uuid,
  p_intent_id uuid,
  p_ref       text,
  p_amount    bigint,
  p_currency  text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_ref is null or p_order_id is null or coalesce(p_amount, 0) <= 0 then
    return;
  end if;
  insert into public.payment_receipt (order_id, payment_intent_id, provider, provider_ref, amount_minor, currency)
  values (p_order_id, p_intent_id, 'monime', p_ref, p_amount, coalesce(p_currency, 'SLE'))
  on conflict (provider, provider_ref) do nothing;
exception when others then
  -- never let bookkeeping abort a payment confirmation
  raise warning 'fn_record_monime_receipt: could not record % for order % (%)', p_ref, p_order_id, sqlerrm;
end;
$$;

revoke execute on function public.fn_record_monime_receipt(uuid, uuid, text, bigint, text) from public, anon, authenticated;
grant  execute on function public.fn_record_monime_receipt(uuid, uuid, text, bigint, text) to service_role;

-- ---- the cap now reads the ledger -----------------------------------------
create or replace function public.fn_assert_refund_cap()
returns trigger language plpgsql set search_path = public as $$
declare
  v_total    bigint;
  v_received bigint;
  v_cap      bigint;
  v_sum      bigint;
begin
  select total_minor into v_total from public."order" where id = new.order_id;

  select coalesce((select sum(amount_minor) from public.payment_receipt where order_id = new.order_id), 0)
       + coalesce((select cod_collected_minor from public.delivery_job where order_id = new.order_id), 0)
    into v_received;

  -- No evidence of what was received (COD not yet collected, or an order that
  -- predates the receipt ledger) -> behave exactly as before.
  v_cap := case when v_received > 0 then v_received else v_total end;

  select coalesce(sum(amount_minor), 0) into v_sum from public.refund
    where order_id = new.order_id and status <> 'failed' and id <> new.id;

  if v_sum + new.amount_minor > v_cap then
    raise exception 'refunds (%) would exceed the % received for order %',
      v_sum + new.amount_minor,
      case when v_received > 0 then v_cap || ' actually' else v_cap || ' order total' end,
      new.order_id;
  end if;
  return new;
end;
$$;

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

    perform public.fn_record_monime_receipt(v_order, p_intent_id, p_provider_ref, p_event_amount, p_event_currency);

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

      perform public.fn_record_monime_receipt(v_order, p_intent_id, p_provider_ref, p_event_amount, p_event_currency);

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

    perform public.fn_record_monime_receipt(v_order, p_intent_id, p_provider_ref, p_event_amount, p_event_currency);

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

  perform public.fn_record_monime_receipt(v_updated, p_intent_id, p_provider_ref, p_event_amount, p_event_currency);

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

-- ---- backfill: every Monime payment we already know landed ----------------
-- Historical orders each had exactly one payment, so provider_intent_id is a
-- sound key for them. This leaves their cap identical to the order total; it is
-- here so the ledger is complete rather than starting today.
insert into public.payment_receipt (order_id, payment_intent_id, provider, provider_ref, amount_minor, currency, received_at)
select pi.order_id, pi.id, 'monime',
       coalesce(pi.paid_provider_ref, pi.provider_intent_id, 'intent:' || pi.id::text),
       pi.amount_minor, pi.currency, coalesce(pi.paid_at, pi.updated_at)
  from public.payment_intent pi
 where pi.provider = 'monime' and pi.status = 'succeeded' and pi.amount_minor > 0
on conflict (provider, provider_ref) do nothing;

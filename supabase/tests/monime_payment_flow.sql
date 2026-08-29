-- monime_payment_flow.sql — manual proof for the Monime payment_intent state
-- machine (NOT a migration). Exercises fn_reserve_stock, fn_expire_monime_intents,
-- and fn_confirm_monime_payment directly against fixture rows rather than going
-- through fn_place_order/the Edge Functions — those three SECURITY DEFINER
-- functions are where the actual money-handling logic lives, and this file
-- documents an exact reproduction of a real production incident (order
-- BS-2026-000042/000043, 2026-08-29): a customer paid via the Monime Payment
-- Code (USSD) flow, but the payment_intent's reservation_expires_at had
-- already passed and the pg_cron sweep (fn_expire_monime_intents, every 5
-- min) had already cancelled the order — so the webhook's later
-- fn_confirm_monime_payment call silently no-op'd as 'already_processed'.
-- Money taken, order lost, nobody notified.
--
-- FIXED by 20260829115411_late_monime_confirmation.sql: that case now returns
-- its own outcome ('late_on_dead_intent', distinct from a benign duplicate's
-- 'already_processed') and files a row into public.refund, which surfaces in
-- the admin_payment_attention queue. Scenarios A and E below are the
-- regression guard for that; D proves a genuine duplicate is still a quiet
-- no-op and does NOT reach the queue.
--
-- Runs entirely inside a transaction that ROLLS BACK, so it seeds nothing
-- permanent. Each scenario uses its own product_variant/inventory_item so
-- scenarios can't contaminate each other's stock counts.
--
-- Run against the LOCAL Supabase stack:
--   supabase db reset
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -f supabase/tests/monime_payment_flow.sql

\set ON_ERROR_STOP on

begin;

-- ---- shared fixture (brand/store/user; one row each, reused by every scenario) ----
do $$
declare
  v_brand uuid;
  v_store uuid;
  v_user  uuid := '99999999-9999-9999-9999-999999999999'::uuid;
begin
  insert into public.brand (name, slug) values ('Test Brand', 'test-brand-monime-flow') returning id into v_brand;
  insert into public.store_location (name, code, type) values ('Test Store', 'TEST-MONIME-FLOW', 'retail_store') returning id into v_store;

  -- auth.users row so app_user's FK is satisfiable — local stack only.
  -- trg_auth_user_created (fn_handle_new_user, 20260616090003_functions_triggers.sql)
  -- already creates the matching public.app_user row on this insert, so patch that
  -- row rather than inserting a second one (which would be a duplicate-key abort).
  insert into auth.users (id, email) values (v_user, 'monime-flow-test@example.com');
  update public.app_user set phone = '+23200000000', display_name = 'Race Condition Tester'
   where id = v_user;

  -- stash ids where later blocks can find them without re-deriving slugs.
  create temporary table if not exists _fixture (key text primary key, id uuid);
  insert into _fixture values ('brand', v_brand), ('store', v_store), ('user', v_user);
end $$;

-- helper: create one product+variant+inventory_item for a scenario, return the variant id.
create or replace function pg_temp.make_variant(p_sku text, p_qty_on_hand int default 10)
returns uuid language plpgsql as $$
declare
  v_brand   uuid := (select id from _fixture where key = 'brand');
  v_product uuid;
  v_variant uuid;
begin
  insert into public.product (brand_id, name, slug) values (v_brand, 'Test Scent ' || p_sku, 'test-scent-' || lower(p_sku))
    returning id into v_product;
  insert into public.product_variant (product_id, size_ml, concentration, sku, price_minor)
    values (v_product, 50, 'EDP', p_sku, 190) returning id into v_variant;
  -- trg_variant_inventory (fn_bootstrap_variant_inventory, same migration) already
  -- created the inventory_item row above; set the scenario's stock level on it.
  update public.inventory_item set qty_on_hand = p_qty_on_hand, qty_reserved = 0
   where variant_id = v_variant;
  return v_variant;
end;
$$;

-- helper: create a pending_payment/monime order + its order_item, return the order id.
create or replace function pg_temp.make_order(p_variant uuid, p_amount bigint default 190)
returns uuid language plpgsql as $$
declare
  v_store uuid := (select id from _fixture where key = 'store');
  v_user  uuid := (select id from _fixture where key = 'user');
  v_order uuid;
begin
  insert into public."order" (
    user_id, status, fulfillment_type, payment_method, store_location_id,
    contact_phone_snapshot, recipient_name_snapshot,
    subtotal_minor, discount_minor, loyalty_redeem_minor, total_minor
  ) values (
    v_user, 'pending_payment', 'pickup', 'monime', v_store,
    '+23200000000', 'Race Condition Tester',
    p_amount, 0, 0, p_amount
  ) returning id into v_order;

  insert into public.order_item (order_id, variant_id, product_name_snapshot, variant_label_snapshot, sku_snapshot, unit_price_minor, qty, line_total_minor)
    select v_order, p_variant, p.name, '50 ml · EDP', pv.sku, p_amount, 1, p_amount
      from public.product_variant pv join public.product p on p.id = pv.product_id
     where pv.id = p_variant;

  return v_order;
end;
$$;

-- =====================================================================
-- Scenario A — THE BUG: reservation expires before a genuinely successful
-- payment's webhook arrives. Documents CURRENT (broken) behavior.
-- =====================================================================
do $$
declare
  v_variant uuid := pg_temp.make_variant('RACE-A');
  v_order   uuid := pg_temp.make_order(v_variant);
  v_intent  uuid;
  v_outcome text;
  v_order_status text;
  v_intent_status text;
  v_reserved int;
  v_refunds int;
begin
  perform public.fn_reserve_stock(v_variant, 1, v_order);

  -- reservation_expires_at already in the past — as if 15+ minutes elapsed
  -- since fn_place_order, exactly like the real incident.
  insert into public.payment_intent (order_id, provider, status, amount_minor, currency, idempotency_key, reservation_expires_at)
    values (v_order, 'monime', 'created', 190, 'SLE', 'test-race-a', now() - interval '1 minute')
    returning id into v_intent;

  -- the pg_cron sweep runs (every 5 min in production) and finds this stale hold.
  perform public.fn_expire_monime_intents();

  select status into v_order_status from public."order" where id = v_order;
  select status, ((select qty_reserved from public.inventory_item where variant_id = v_variant)) into v_intent_status, v_reserved
    from public.payment_intent where id = v_intent;

  if v_order_status <> 'cancelled' then raise exception 'FAIL ✗  sweep should cancel the order, got %', v_order_status; end if;
  if v_intent_status <> 'expired' then raise exception 'FAIL ✗  sweep should expire the intent, got %', v_intent_status; end if;
  if v_reserved <> 0 then raise exception 'FAIL ✗  sweep should release the stock hold, got qty_reserved=%', v_reserved; end if;
  raise notice 'PASS ✓  sweep cancels order + expires intent + releases stock hold (as designed)';

  -- NOW the customer's payment actually completes and Monime's webhook lands —
  -- same amount/currency as the intent, arriving just after the sweep.
  select public.fn_confirm_monime_payment(v_intent, 190, 'SLE') into v_outcome;

  select status into v_order_status from public."order" where id = v_order;
  select status into v_intent_status from public.payment_intent where id = v_intent;

  -- The fix: this is NOT a benign duplicate, and must not be reported as one.
  if v_outcome <> 'late_on_dead_intent' then
    raise exception 'FAIL ✗  a late confirmation on an expired intent must be distinguishable from a duplicate, got outcome=%', v_outcome;
  end if;

  -- Deliberately NOT auto-reinstated: the stock was released by the sweep and
  -- may already be sold to someone else, so refund-vs-re-place is a staff call.
  if v_order_status <> 'cancelled' then
    raise exception 'FAIL ✗  a late confirmation must not silently re-confirm the order, got %', v_order_status;
  end if;
  if v_intent_status <> 'expired' then
    raise exception 'FAIL ✗  a late confirmation must not silently flip the dead intent, got %', v_intent_status;
  end if;

  -- ...but it MUST land somewhere a human looks.
  select count(*) into v_refunds
    from public.refund
   where payment_intent_id = v_intent and reason = 'late_monime_confirmation' and status = 'pending';
  if v_refunds <> 1 then
    raise exception 'FAIL ✗  expected exactly 1 pending refund-queue row for the late payment, got %', v_refunds;
  end if;
  select count(*) into v_refunds from public.admin_payment_attention where payment_intent_id = v_intent;
  if v_refunds <> 1 then
    raise exception 'FAIL ✗  the flagged payment must appear in admin_payment_attention, got % rows', v_refunds;
  end if;

  -- A webhook retry must not pile up a second queue row.
  select public.fn_confirm_monime_payment(v_intent, 190, 'SLE') into v_outcome;
  select count(*) into v_refunds
    from public.refund where payment_intent_id = v_intent and reason = 'late_monime_confirmation';
  if v_refunds <> 1 then
    raise exception 'FAIL ✗  a redelivered late webhook must not queue a second refund row, got %', v_refunds;
  end if;

  raise notice 'PASS ✓  a late payment on an expired intent returns late_on_dead_intent, leaves the order alone, and lands in the refund queue exactly once';
end $$;

-- =====================================================================
-- Scenario B — happy path: webhook arrives BEFORE the reservation expires.
-- =====================================================================
do $$
declare
  v_variant uuid := pg_temp.make_variant('HAPPY-B');
  v_order   uuid := pg_temp.make_order(v_variant);
  v_intent  uuid;
  v_outcome text;
  v_order_status text;
  v_qty_on_hand int;
  v_qty_reserved int;
begin
  perform public.fn_reserve_stock(v_variant, 1, v_order);

  insert into public.payment_intent (order_id, provider, status, amount_minor, currency, idempotency_key, reservation_expires_at)
    values (v_order, 'monime', 'created', 190, 'SLE', 'test-happy-b', now() + interval '15 minutes')
    returning id into v_intent;

  select public.fn_confirm_monime_payment(v_intent, 190, 'SLE') into v_outcome;

  select status into v_order_status from public."order" where id = v_order;
  select qty_on_hand, qty_reserved into v_qty_on_hand, v_qty_reserved from public.inventory_item where variant_id = v_variant;

  if v_outcome <> 'confirmed' then raise exception 'FAIL ✗  expected confirmed, got %', v_outcome; end if;
  if v_order_status <> 'confirmed' then raise exception 'FAIL ✗  expected order confirmed, got %', v_order_status; end if;
  if v_qty_reserved <> 0 then raise exception 'FAIL ✗  hold should be consumed (reserved=0), got %', v_qty_reserved; end if;
  if v_qty_on_hand <> 9 then raise exception 'FAIL ✗  on-hand should drop by 1 (from 10), got %', v_qty_on_hand; end if;
  raise notice 'PASS ✓  in-time webhook confirms order + converts the hold into a real sale';
end $$;

-- =====================================================================
-- Scenario C — amount/currency mismatch guard.
-- =====================================================================
do $$
declare
  v_variant uuid := pg_temp.make_variant('MISMATCH-C');
  v_order   uuid := pg_temp.make_order(v_variant);
  v_intent  uuid;
  v_outcome text;
  v_order_status text;
begin
  perform public.fn_reserve_stock(v_variant, 1, v_order);
  insert into public.payment_intent (order_id, provider, status, amount_minor, currency, idempotency_key, reservation_expires_at)
    values (v_order, 'monime', 'created', 190, 'SLE', 'test-mismatch-c', now() + interval '15 minutes')
    returning id into v_intent;

  select public.fn_confirm_monime_payment(v_intent, 999, 'SLE') into v_outcome;
  select status into v_order_status from public."order" where id = v_order;

  if v_outcome <> 'amount_mismatch' then raise exception 'FAIL ✗  expected amount_mismatch, got %', v_outcome; end if;
  if v_order_status <> 'pending_payment' then raise exception 'FAIL ✗  a mismatched event must not confirm the order, got %', v_order_status; end if;
  raise notice 'PASS ✓  amount/currency mismatch is rejected without touching the order';
end $$;

-- =====================================================================
-- Scenario D — duplicate webhook delivery is idempotent at the DB layer
-- (belt-and-suspenders under the webhook's own event.id dedup).
-- =====================================================================
do $$
declare
  v_variant uuid := pg_temp.make_variant('DUPE-D');
  v_order   uuid := pg_temp.make_order(v_variant);
  v_intent  uuid;
  v_outcome1 text;
  v_outcome2 text;
  v_qty_on_hand int;
  v_refunds int;
begin
  perform public.fn_reserve_stock(v_variant, 1, v_order);
  insert into public.payment_intent (order_id, provider, status, amount_minor, currency, idempotency_key, reservation_expires_at)
    values (v_order, 'monime', 'created', 190, 'SLE', 'test-dupe-d', now() + interval '15 minutes')
    returning id into v_intent;

  select public.fn_confirm_monime_payment(v_intent, 190, 'SLE') into v_outcome1;
  select public.fn_confirm_monime_payment(v_intent, 190, 'SLE') into v_outcome2;
  select qty_on_hand into v_qty_on_hand from public.inventory_item where variant_id = v_variant;

  if v_outcome1 <> 'confirmed' then raise exception 'FAIL ✗  first delivery should confirm, got %', v_outcome1; end if;
  if v_outcome2 <> 'already_processed' then raise exception 'FAIL ✗  second delivery should no-op, got %', v_outcome2; end if;
  if v_qty_on_hand <> 9 then raise exception 'FAIL ✗  stock must only be sold ONCE despite two deliveries, got on_hand=%', v_qty_on_hand; end if;

  -- The other half of the fix: a duplicate is genuinely nothing, so it must
  -- NOT reach the refund queue. If this ever fires, staff get buried in noise
  -- and stop reading the queue that exists for Scenario A/E.
  select count(*) into v_refunds from public.refund where payment_intent_id = v_intent;
  if v_refunds <> 0 then
    raise exception 'FAIL ✗  a benign duplicate must not queue anything for review, got % refund row(s)', v_refunds;
  end if;
  raise notice 'PASS ✓  duplicate webhook delivery does not double-sell stock and never reaches the refund queue';
end $$;

-- =====================================================================
-- Scenario E — the same late-confirmation case, but reached through a STAFF
-- cancellation (fn_cancel_pending_monime_order) instead of the cron sweep.
-- Same customer harm, different door in — the fix must cover both.
-- =====================================================================
do $$
declare
  v_variant uuid := pg_temp.make_variant('STAFF-E');
  v_order   uuid := pg_temp.make_order(v_variant);
  v_intent  uuid;
  v_outcome text;
  v_order_status text;
  v_intent_status text;
  v_refunds int;
begin
  perform public.fn_reserve_stock(v_variant, 1, v_order);
  insert into public.payment_intent (order_id, provider, status, amount_minor, currency, idempotency_key, reservation_expires_at)
    values (v_order, 'monime', 'created', 190, 'SLE', 'test-staff-e', now() + interval '15 minutes')
    returning id into v_intent;

  -- staff give up on the unpaid order and cancel it...
  if public.fn_cancel_pending_monime_order(v_order, null) <> 'cancelled' then
    raise exception 'FAIL ✗  fixture: staff cancel did not take';
  end if;

  -- ...and only then does the customer's payment land.
  select public.fn_confirm_monime_payment(v_intent, 190, 'SLE') into v_outcome;
  select status into v_order_status from public."order" where id = v_order;
  select status into v_intent_status from public.payment_intent where id = v_intent;
  select count(*) into v_refunds
    from public.refund where payment_intent_id = v_intent and reason = 'late_monime_confirmation';

  if v_outcome <> 'late_on_dead_intent' then
    raise exception 'FAIL ✗  a late payment on a staff-cancelled intent must flag too, got %', v_outcome;
  end if;
  if v_order_status <> 'cancelled' then raise exception 'FAIL ✗  staff cancellation must stand, got %', v_order_status; end if;
  if v_intent_status <> 'cancelled' then raise exception 'FAIL ✗  intent should stay cancelled, got %', v_intent_status; end if;
  if v_refunds <> 1 then raise exception 'FAIL ✗  expected 1 refund-queue row, got %', v_refunds; end if;
  raise notice 'PASS ✓  staff-cancelled orders that get paid late are flagged the same way the sweep-cancelled ones are';
end $$;

rollback;

\echo ''
\echo 'monime_payment_flow.sql complete — transaction rolled back, no data persisted.'
\echo 'All five scenarios should print PASS. Scenario A and E are the regression guard for'
\echo 'the 2026-08-29 incident: a late payment must return late_on_dead_intent and reach the'
\echo 'refund queue; Scenario D guards the other side — a real duplicate must stay silent.'

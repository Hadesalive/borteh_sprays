-- 20260616090003_functions_triggers.sql
-- Role helpers, updated_at triggers, auth->app_user bootstrap, inventory RPCs
-- (oversell-safe per ADR-010), availability band maintenance, review rollups, realtime.

-- =====================================================================
-- Role helpers (SECURITY DEFINER so they bypass RLS on app_user — no recursion)
-- =====================================================================
create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.app_user where id = auth.uid()), 'anon');
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('staff','owner') from public.app_user where id = auth.uid()), false);
$$;

create or replace function public.current_rider_id()
returns uuid language sql stable security definer set search_path = public as $$
  select r.id from public.rider r where r.user_id = auth.uid();
$$;

grant execute on function public.current_app_role(), public.is_staff(), public.current_rider_id()
  to anon, authenticated;

-- =====================================================================
-- updated_at triggers on every table that has the column
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'brand','category','product','product_variant','product_image','scent_note',
    'store_location','app_user','inventory_item','availability_signal','delivery_zone',
    'delivery_location','rider','wishlist','cart','cart_item','promo_code','order',
    'payment_intent','refund','delivery_job','restock_subscription','review',
    'notification_preference','loyalty_config','promo_rule','loyalty_tier','loyalty_account','conversation'
  ]
  loop
    execute format(
      'create or replace trigger trg_%s_updated before update on public.%I for each row execute function public.set_updated_at()',
      t, t);
  end loop;
end $$;

-- =====================================================================
-- New auth user -> app_user profile (phone is the login id, ADR-004)
-- =====================================================================
create or replace function public.fn_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_user (id, phone, email, display_name)
  values (
    new.id,
    coalesce(new.phone, new.id::text),                 -- phone+password is primary; fallback keeps NOT NULL safe
    new.email,
    new.raw_user_meta_data->>'display_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();

-- =====================================================================
-- Variant -> inventory bootstrap + availability band maintenance
-- =====================================================================
create or replace function public.fn_recompute_band(p_variant uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_avail int; v_reorder int; v_band text;
begin
  select (qty_on_hand - qty_reserved), reorder_point
    into v_avail, v_reorder
    from public.inventory_item where variant_id = p_variant;
  if v_avail is null then return; end if;
  v_band := case when v_avail <= 0                        then 'out'
                 when v_avail <= coalesce(v_reorder, 0)   then 'low'
                 else 'in_stock' end;
  insert into public.availability_signal (variant_id, band, updated_at)
    values (p_variant, v_band, now())
    on conflict (variant_id) do update set band = excluded.band, updated_at = now();
end;
$$;

create or replace function public.fn_bootstrap_variant_inventory()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.inventory_item (variant_id) values (new.id) on conflict (variant_id) do nothing;
  insert into public.availability_signal (variant_id, band) values (new.id, 'out') on conflict (variant_id) do nothing;
  return new;
end;
$$;

create or replace trigger trg_variant_inventory
  after insert on public.product_variant
  for each row execute function public.fn_bootstrap_variant_inventory();

-- =====================================================================
-- Inventory RPCs (ADR-010). The hold/decrement RPCs (reserve, confirm, release,
-- sell_instore) lock the inventory_item row (FOR UPDATE) and validate before mutating;
-- receive/adjust/return use atomic in-place UPDATEs. All write the two-dimension ledger
-- and refresh the availability band.
-- Called by service-role Edge Functions / POS-lite; never by customers directly.
-- =====================================================================

-- Hold stock for an online order. TRUE if held, FALSE if insufficient.
create or replace function public.fn_reserve_stock(p_variant uuid, p_qty int, p_order uuid, p_actor uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_on int; v_res int;
begin
  if p_qty <= 0 then raise exception 'qty must be positive'; end if;
  select qty_on_hand, qty_reserved into v_on, v_res
    from public.inventory_item where variant_id = p_variant for update;
  if not found then return false; end if;
  if (v_on - v_res) < p_qty then return false; end if;
  update public.inventory_item
     set qty_reserved = qty_reserved + p_qty, updated_at = now()
   where variant_id = p_variant
   returning qty_on_hand, qty_reserved into v_on, v_res;
  insert into public.stock_ledger(variant_id, movement_type, qty_delta, qty_reserved_delta,
      balance_after, reserved_after, reference_type, reference_id, created_by)
    values (p_variant, 'reservation', 0, p_qty, v_on, v_res, 'order', p_order, p_actor);
  perform public.fn_recompute_band(p_variant);
  return true;
end;
$$;

-- Confirm an online sale (consume a hold): on_hand -= qty, reserved -= qty.
-- Locks the row and validates. Idempotency (audit C3): the payment webhook and the
-- reservation-expiry sweep can both fire; once the hold is consumed, reserved < p_qty and a
-- second call RAISES instead of double-decrementing. Callers treat the exception as "already
-- settled" (the status-guarded payment_intent UPDATE is the primary single-apply gate).
create or replace function public.fn_confirm_sale_online(p_variant uuid, p_qty int, p_order uuid, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_on int; v_res int;
begin
  if p_qty <= 0 then raise exception 'qty must be positive'; end if;
  select qty_on_hand, qty_reserved into v_on, v_res
    from public.inventory_item where variant_id = p_variant for update;
  if not found then raise exception 'inventory_item missing for variant %', p_variant; end if;
  if v_res < p_qty then
    raise exception 'cannot confirm % units; only % reserved (variant %)', p_qty, v_res, p_variant;
  end if;
  if v_on < p_qty then
    raise exception 'cannot confirm % units; only % on hand (variant %)', p_qty, v_on, p_variant;
  end if;
  update public.inventory_item
     set qty_on_hand = qty_on_hand - p_qty, qty_reserved = qty_reserved - p_qty, updated_at = now()
   where variant_id = p_variant
   returning qty_on_hand, qty_reserved into v_on, v_res;
  insert into public.stock_ledger(variant_id, movement_type, qty_delta, qty_reserved_delta,
      balance_after, reserved_after, reference_type, reference_id, created_by)
    values (p_variant, 'sale_online', -p_qty, -p_qty, v_on, v_res, 'order', p_order, p_actor);
  perform public.fn_recompute_band(p_variant);
end;
$$;

-- Release an unconsumed hold (expiry/cancel): reserved -= qty.
-- Locks + validates (audit C3): no GREATEST clamp — over-release RAISES so a double release
-- (sweep + webhook) can never write a -p_qty ledger row against an already-zero balance and
-- break SUM(qty_reserved_delta) = qty_reserved.
create or replace function public.fn_release_reservation(p_variant uuid, p_qty int, p_order uuid, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_on int; v_res int;
begin
  if p_qty <= 0 then raise exception 'qty must be positive'; end if;
  select qty_on_hand, qty_reserved into v_on, v_res
    from public.inventory_item where variant_id = p_variant for update;
  if not found then raise exception 'inventory_item missing for variant %', p_variant; end if;
  if v_res < p_qty then
    raise exception 'cannot release % units; only % reserved (variant %)', p_qty, v_res, p_variant;
  end if;
  update public.inventory_item set qty_reserved = qty_reserved - p_qty, updated_at = now()
   where variant_id = p_variant
   returning qty_on_hand, qty_reserved into v_on, v_res;
  insert into public.stock_ledger(variant_id, movement_type, qty_delta, qty_reserved_delta,
      balance_after, reserved_after, reference_type, reference_id, created_by)
    values (p_variant, 'release', 0, -p_qty, v_on, v_res, 'order', p_order, p_actor);
  perform public.fn_recompute_band(p_variant);
end;
$$;

-- In-store POS-lite sale (no prior hold): guard available, on_hand -= qty.
create or replace function public.fn_sell_instore(p_variant uuid, p_qty int, p_actor uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_on int; v_res int;
begin
  if p_qty <= 0 then raise exception 'qty must be positive'; end if;
  select qty_on_hand, qty_reserved into v_on, v_res
    from public.inventory_item where variant_id = p_variant for update;
  if not found then return false; end if;
  if (v_on - v_res) < p_qty then return false; end if;
  update public.inventory_item set qty_on_hand = qty_on_hand - p_qty, updated_at = now()
   where variant_id = p_variant returning qty_on_hand, qty_reserved into v_on, v_res;
  insert into public.stock_ledger(variant_id, movement_type, qty_delta, qty_reserved_delta,
      balance_after, reserved_after, reference_type, reference_id, created_by)
    values (p_variant, 'sale_instore', -p_qty, 0, v_on, v_res, 'manual', null, p_actor);
  perform public.fn_recompute_band(p_variant);
  return true;
end;
$$;

-- Goods receipt: on_hand += qty.
create or replace function public.fn_receive_stock(p_variant uuid, p_qty int, p_actor uuid default null, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_on int; v_res int;
begin
  if p_qty <= 0 then raise exception 'qty must be positive'; end if;
  update public.inventory_item set qty_on_hand = qty_on_hand + p_qty, updated_at = now()
   where variant_id = p_variant returning qty_on_hand, qty_reserved into v_on, v_res;
  insert into public.stock_ledger(variant_id, movement_type, qty_delta, qty_reserved_delta,
      balance_after, reserved_after, reference_type, reference_id, reason, created_by)
    values (p_variant, 'purchase', p_qty, 0, v_on, v_res, 'manual', null, p_reason, p_actor);
  perform public.fn_recompute_band(p_variant);
end;
$$;

-- Manual correction: on_hand += delta (CHECKs guard against going negative / reserved>on_hand).
create or replace function public.fn_adjust_stock(p_variant uuid, p_delta int, p_actor uuid default null, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_on int; v_res int;
begin
  if p_delta = 0 then return; end if;
  update public.inventory_item set qty_on_hand = qty_on_hand + p_delta, updated_at = now()
   where variant_id = p_variant returning qty_on_hand, qty_reserved into v_on, v_res;
  insert into public.stock_ledger(variant_id, movement_type, qty_delta, qty_reserved_delta,
      balance_after, reserved_after, reference_type, reference_id, reason, created_by)
    values (p_variant, 'adjustment', p_delta, 0, v_on, v_res, 'manual', null, p_reason, p_actor);
  perform public.fn_recompute_band(p_variant);
end;
$$;

-- Post-delivery return restock: on_hand += qty.
create or replace function public.fn_return_stock(p_variant uuid, p_qty int, p_order uuid, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_on int; v_res int;
begin
  if p_qty <= 0 then raise exception 'qty must be positive'; end if;
  update public.inventory_item set qty_on_hand = qty_on_hand + p_qty, updated_at = now()
   where variant_id = p_variant returning qty_on_hand, qty_reserved into v_on, v_res;
  insert into public.stock_ledger(variant_id, movement_type, qty_delta, qty_reserved_delta,
      balance_after, reserved_after, reference_type, reference_id, created_by)
    values (p_variant, 'return', p_qty, 0, v_on, v_res, 'order', p_order, p_actor);
  perform public.fn_recompute_band(p_variant);
end;
$$;

-- Lock down the inventory mutators: callable by service-role Edge Functions only,
-- never by anon/authenticated through the PostgREST RPC endpoint.
revoke execute on function
  public.fn_reserve_stock(uuid,int,uuid,uuid),
  public.fn_confirm_sale_online(uuid,int,uuid,uuid),
  public.fn_release_reservation(uuid,int,uuid,uuid),
  public.fn_sell_instore(uuid,int,uuid),
  public.fn_receive_stock(uuid,int,uuid,text),
  public.fn_adjust_stock(uuid,int,uuid,text),
  public.fn_return_stock(uuid,int,uuid,uuid),
  public.fn_recompute_band(uuid)
  from public, anon, authenticated;
grant execute on function
  public.fn_reserve_stock(uuid,int,uuid,uuid),
  public.fn_confirm_sale_online(uuid,int,uuid,uuid),
  public.fn_release_reservation(uuid,int,uuid,uuid),
  public.fn_sell_instore(uuid,int,uuid),
  public.fn_receive_stock(uuid,int,uuid,text),
  public.fn_adjust_stock(uuid,int,uuid,text),
  public.fn_return_stock(uuid,int,uuid,uuid),
  public.fn_recompute_band(uuid)
  to service_role;

-- =====================================================================
-- Review -> product rating rollup (only published reviews count)
-- =====================================================================
create or replace function public.fn_review_rollup()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pid uuid;
begin
  v_pid := coalesce(new.product_id, old.product_id);
  update public.product p set
    review_count = (select count(*) from public.review r where r.product_id = v_pid and r.status = 'published'),
    avg_rating   = coalesce((select round(avg(rating)::numeric, 1) from public.review r
                              where r.product_id = v_pid and r.status = 'published'), 0)
  where p.id = v_pid;
  return null;
end;
$$;

create or replace trigger trg_review_rollup
  after insert or update or delete on public.review
  for each row execute function public.fn_review_rollup();

-- =====================================================================
-- Financial & quantity integrity guards (audit C5 / H4 / H5 / H6)
-- =====================================================================

-- C5: order.subtotal_minor must equal SUM(order_item.line_total_minor).
-- A CHECK can't see child rows; a DEFERRED constraint trigger validates at COMMIT,
-- after the checkout RPC has inserted the order then its items in one transaction.
create or replace function public.fn_assert_order_subtotal()
returns trigger language plpgsql set search_path = public as $$
declare v_sum bigint;
begin
  select coalesce(sum(line_total_minor), 0) into v_sum
    from public.order_item where order_id = new.id;
  if new.subtotal_minor <> v_sum then
    raise exception 'subtotal_minor % <> sum(line_total) % for order %', new.subtotal_minor, v_sum, new.id;
  end if;
  return null;
end;
$$;
drop trigger if exists trg_order_subtotal on public."order";  -- idempotent: constraint triggers have no CREATE OR REPLACE
create constraint trigger trg_order_subtotal
  after insert or update on public."order"
  deferrable initially deferred
  for each row execute function public.fn_assert_order_subtotal();

-- H4: a payment_intent's amount must equal the order total at creation time
-- (the owner confirms delivery_fee_minor before a Monime intent is created — ADR-013).
create or replace function public.fn_assert_intent_amount()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.amount_minor <> (select total_minor from public."order" where id = new.order_id) then
    raise exception 'payment_intent.amount_minor % <> order.total_minor for order %', new.amount_minor, new.order_id;
  end if;
  return new;
end;
$$;
create or replace trigger trg_intent_amount
  before insert on public.payment_intent
  for each row execute function public.fn_assert_intent_amount();

-- H5: for a COD order, delivery_job.cod_expected_minor must equal the order total
-- (the rider is the cash interface — a mismatch means collecting the wrong amount).
create or replace function public.fn_assert_cod_expected()
returns trigger language plpgsql set search_path = public as $$
declare v_method text; v_total bigint;
begin
  select payment_method, total_minor into v_method, v_total from public."order" where id = new.order_id;
  if v_method = 'cash_on_delivery' and new.cod_expected_minor <> v_total then
    raise exception 'cod_expected_minor % <> order total % for COD order %', new.cod_expected_minor, v_total, new.order_id;
  end if;
  return new;
end;
$$;
create or replace trigger trg_cod_expected
  before insert or update on public.delivery_job
  for each row execute function public.fn_assert_cod_expected();

-- H6: the sum of non-failed refunds for an order may not exceed the order total.
create or replace function public.fn_assert_refund_cap()
returns trigger language plpgsql set search_path = public as $$
declare v_total bigint; v_sum bigint;
begin
  select total_minor into v_total from public."order" where id = new.order_id;
  select coalesce(sum(amount_minor), 0) into v_sum from public.refund
    where order_id = new.order_id and status <> 'failed' and id <> new.id;
  if v_sum + new.amount_minor > v_total then
    raise exception 'refunds (%) would exceed order total % for order %', v_sum + new.amount_minor, v_total, new.order_id;
  end if;
  return new;
end;
$$;
create or replace trigger trg_refund_cap
  before insert or update on public.refund
  for each row execute function public.fn_assert_refund_cap();

-- =====================================================================
-- Realtime: customers subscribe to the coarse stock band + their in-app feed
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.availability_signal; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.notification;         exception when duplicate_object then null; end;
  end if;
end $$;

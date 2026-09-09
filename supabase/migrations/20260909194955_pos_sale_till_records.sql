-- Counter (POS) sales become their own record instead of pickup orders.
--
-- Until now fn_pos_sale inserted a regular "order" row (fulfillment 'pickup',
-- status 'confirmed', user = the Walk-in customer). That put every till sale
-- into the dispatch queue, counted collected cash toward "COD to collect"
-- forever, and left nothing in the schema that says "this was a counter sale".
--
-- This migration:
--   1. adds pos_sale / pos_sale_item (a till receipt: cashier, cash or mobile
--      money with an optional reference, void with reason);
--   2. rewrites fn_pos_sale to write those tables and move stock directly
--      (ledger 'sale_instore', reference 'pos_sale'), and adds fn_void_pos_sale;
--   3. backfills historical walk-in orders into pos_sale (keeping their ids so
--      old ledger references still resolve) and removes them from "order";
--   4. rebuilds the admin stat views so revenue = app orders + till sales,
--      with the split exposed for the dashboard and analytics.

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
create sequence if not exists public.pos_receipt_seq;

create or replace function public.gen_receipt_number()
returns text language sql volatile as $$
  select 'T-' || to_char(now(), 'YYYY') || '-'
         || lpad(nextval('public.pos_receipt_seq')::text, 6, '0');
$$;

create table if not exists public.pos_sale (
  id                 uuid primary key default gen_random_uuid(),
  receipt_number     text not null unique default public.gen_receipt_number(),
  store_location_id  uuid not null references public.store_location(id),
  cashier_id         uuid references public.app_user(id) on delete set null,
  payment_method     text not null check (payment_method in ('cash','mobile_money')),
  payment_reference  text,
  subtotal_minor     bigint not null check (subtotal_minor >= 0),
  discount_minor     bigint not null default 0 check (discount_minor >= 0),
  total_minor        bigint not null check (total_minor >= 0),
  status             text not null default 'completed' check (status in ('completed','voided')),
  void_reason        text,
  voided_by          uuid references public.app_user(id) on delete set null,
  voided_at          timestamptz,
  sold_at            timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  constraint ck_pos_sale_total check (total_minor = subtotal_minor - discount_minor),
  constraint ck_pos_sale_void check (
    (status = 'completed' and voided_at is null and void_reason is null)
    or (status = 'voided' and voided_at is not null and void_reason is not null)
  )
);
create index if not exists idx_pos_sale_sold_at on public.pos_sale (sold_at desc);
create index if not exists idx_pos_sale_status  on public.pos_sale (status, sold_at desc);

create table if not exists public.pos_sale_item (
  id                     uuid primary key default gen_random_uuid(),
  sale_id                uuid not null references public.pos_sale(id) on delete cascade,
  variant_id             uuid references public.product_variant(id) on delete set null,
  product_name_snapshot  text not null,
  variant_label_snapshot text not null default '',
  sku_snapshot           text not null default '',
  unit_price_minor       bigint not null check (unit_price_minor >= 0),
  qty                    int not null check (qty > 0),
  line_total_minor       bigint not null check (line_total_minor >= 0)
);
create index if not exists idx_pos_sale_item_sale on public.pos_sale_item (sale_id);

alter table public.pos_sale      enable row level security;
alter table public.pos_sale_item enable row level security;

drop policy if exists pos_sale_staff on public.pos_sale;
create policy pos_sale_staff on public.pos_sale
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists pos_sale_item_staff on public.pos_sale_item;
create policy pos_sale_item_staff on public.pos_sale_item
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- 2. Functions
-- ---------------------------------------------------------------------
drop function if exists public.fn_pos_sale(uuid, uuid, text, jsonb);
drop function if exists public.fn_pos_sale(uuid, uuid, text, jsonb, bigint);

-- A counter sale: nothing to reserve, the bottle leaves the shelf now.
create or replace function public.fn_pos_sale(
  p_store uuid,
  p_cashier uuid,
  p_payment text,
  p_reference text,
  p_items jsonb,
  p_discount_minor bigint default 0
) returns table(sale_id uuid, receipt_number text)
language plpgsql security definer set search_path = public as $$
declare
  v_sale_id uuid;
  v_receipt text;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_variant uuid;
  v_qty int;
  v_on int;
  v_res int;
  it jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'no items';
  end if;
  if p_payment not in ('cash','mobile_money') then
    raise exception 'payment must be cash or mobile_money';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_subtotal := v_subtotal + (it->>'unit_price_minor')::bigint * (it->>'qty')::int;
  end loop;
  v_discount := least(greatest(coalesce(p_discount_minor, 0), 0), v_subtotal);

  insert into public.pos_sale(store_location_id, cashier_id, payment_method, payment_reference,
      subtotal_minor, discount_minor, total_minor)
    values (p_store, p_cashier, p_payment, nullif(trim(coalesce(p_reference, '')), ''),
      v_subtotal, v_discount, v_subtotal - v_discount)
    returning id, pos_sale.receipt_number into v_sale_id, v_receipt;

  for it in select * from jsonb_array_elements(p_items) loop
    v_variant := (it->>'variant_id')::uuid;
    v_qty     := (it->>'qty')::int;
    if v_qty <= 0 then raise exception 'qty must be positive'; end if;

    insert into public.pos_sale_item(sale_id, variant_id, product_name_snapshot,
        variant_label_snapshot, sku_snapshot, unit_price_minor, qty, line_total_minor)
      values (v_sale_id, v_variant, it->>'name',
        coalesce(it->>'label',''), coalesce(it->>'sku',''),
        (it->>'unit_price_minor')::bigint, v_qty,
        (it->>'unit_price_minor')::bigint * v_qty);

    select qty_on_hand, qty_reserved into v_on, v_res
      from public.inventory_item where variant_id = v_variant for update;
    if not found then raise exception 'no inventory row for variant %', v_variant; end if;
    if (v_on - v_res) < v_qty then
      raise exception 'insufficient stock for %: % available, % requested',
        it->>'name', v_on - v_res, v_qty;
    end if;

    update public.inventory_item
       set qty_on_hand = qty_on_hand - v_qty, updated_at = now()
     where variant_id = v_variant
     returning qty_on_hand, qty_reserved into v_on, v_res;

    insert into public.stock_ledger(variant_id, movement_type, qty_delta, qty_reserved_delta,
        balance_after, reserved_after, reference_type, reference_id, created_by)
      values (v_variant, 'sale_instore', -v_qty, 0, v_on, v_res, 'pos_sale', v_sale_id, p_cashier);

    perform public.fn_recompute_band(v_variant);
  end loop;

  return query select v_sale_id, v_receipt;
end;
$$;

-- Void a completed sale: stock goes back on the shelf, the receipt stays on
-- record (struck through) so the day's history is never silently edited.
create or replace function public.fn_void_pos_sale(p_sale uuid, p_actor uuid, p_reason text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  r record;
  v_on int;
  v_res int;
begin
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'a reason is required to void a sale';
  end if;

  select status into v_status from public.pos_sale where id = p_sale for update;
  if not found then raise exception 'sale not found'; end if;
  if v_status <> 'completed' then return false; end if;

  update public.pos_sale
     set status = 'voided', void_reason = trim(p_reason), voided_by = p_actor, voided_at = now()
   where id = p_sale;

  for r in select variant_id, qty from public.pos_sale_item where sale_id = p_sale and variant_id is not null loop
    update public.inventory_item
       set qty_on_hand = qty_on_hand + r.qty, updated_at = now()
     where variant_id = r.variant_id
     returning qty_on_hand, qty_reserved into v_on, v_res;
    if found then
      insert into public.stock_ledger(variant_id, movement_type, qty_delta, qty_reserved_delta,
          balance_after, reserved_after, reference_type, reference_id, reason, created_by)
        values (r.variant_id, 'return', r.qty, 0, v_on, v_res, 'pos_sale', p_sale, trim(p_reason), p_actor);
      perform public.fn_recompute_band(r.variant_id);
    end if;
  end loop;

  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Backfill historical walk-in orders → pos_sale (idempotent)
-- ---------------------------------------------------------------------
-- The only thing that ever wrote fulfillment_type = 'pickup' was the old
-- fn_pos_sale (the customer app hardcodes 'delivery'), so 'pickup' IS the
-- counter-sale marker. Their order ids are reused as pos_sale ids so existing
-- stock_ledger rows (reference_type 'order', reference_id = the order) still
-- point at the sale. Orders that somehow got a payment_intent or refund are
-- left alone (restrict FKs).
do $$
begin
  insert into public.pos_sale(id, receipt_number, store_location_id, cashier_id, payment_method,
      payment_reference, subtotal_minor, discount_minor, total_minor, status, void_reason,
      voided_by, voided_at, sold_at, created_at)
  select o.id,
         'T-' || to_char(coalesce(o.placed_at, o.created_at), 'YYYY') || '-'
               || lpad(nextval('public.pos_receipt_seq')::text, 6, '0'),
         o.store_location_id,
         null,
         case when o.payment_method = 'monime' then 'mobile_money' else 'cash' end,
         null,
         o.subtotal_minor,
         -- Keep the money that was actually taken: derive the discount from
         -- the order's real total so ck_pos_sale_total always holds.
         o.subtotal_minor - o.total_minor,
         o.total_minor,
         case when o.status in ('cancelled','returned') then 'voided' else 'completed' end,
         case when o.status in ('cancelled','returned') then 'Migrated: order was ' || o.status end,
         null,
         case when o.status in ('cancelled','returned') then coalesce(o.cancelled_at, o.placed_at, o.created_at) end,
         coalesce(o.placed_at, o.created_at),
         o.created_at
    from public."order" o
   where o.fulfillment_type = 'pickup'
     and not exists (select 1 from public.pos_sale s where s.id = o.id)
     and not exists (select 1 from public.payment_intent pi where pi.order_id = o.id)
     and not exists (select 1 from public.refund rf where rf.order_id = o.id)
   order by coalesce(o.placed_at, o.created_at);

  insert into public.pos_sale_item(sale_id, variant_id, product_name_snapshot, variant_label_snapshot,
      sku_snapshot, unit_price_minor, qty, line_total_minor)
  select oi.order_id, oi.variant_id, oi.product_name_snapshot, coalesce(oi.variant_label_snapshot, ''),
         coalesce(oi.sku_snapshot, ''), oi.unit_price_minor, oi.qty, oi.line_total_minor
    from public.order_item oi
    join public.pos_sale s on s.id = oi.order_id
   where not exists (select 1 from public.pos_sale_item si where si.sale_id = oi.order_id);

  delete from public."order" o
   where o.fulfillment_type = 'pickup'
     and exists (select 1 from public.pos_sale s where s.id = o.id);
end $$;

-- ---------------------------------------------------------------------
-- 4. Stat views: revenue = app orders + till sales
-- ---------------------------------------------------------------------
-- One row per revenue event, either channel, already filtered to "counts".
create or replace view public.admin_revenue_event as
select 'app'::text as channel, o.id, o.total_minor, coalesce(o.placed_at, o.created_at) as at
  from public."order" o
 where o.status not in ('cancelled', 'returned')
union all
select 'pos'::text, s.id, s.total_minor, s.sold_at
  from public.pos_sale s
 where s.status = 'completed';
alter view public.admin_revenue_event set (security_invoker = on);

create or replace view public.admin_revenue_event_item as
select 'app'::text as channel, oi.product_name_snapshot, oi.variant_label_snapshot, oi.qty,
       oi.line_total_minor, coalesce(o.placed_at, o.created_at) as at
  from public.order_item oi
  join public."order" o on o.id = oi.order_id
 where o.status not in ('cancelled', 'returned')
union all
select 'pos'::text, si.product_name_snapshot, si.variant_label_snapshot, si.qty,
       si.line_total_minor, s.sold_at
  from public.pos_sale_item si
  join public.pos_sale s on s.id = si.sale_id
 where s.status = 'completed';
alter view public.admin_revenue_event_item set (security_invoker = on);

drop view if exists public.admin_overview_stats;
create view public.admin_overview_stats as
with ev as (select * from public.admin_revenue_event),
     app as (
       select status, coalesce(placed_at, created_at) as at
         from public."order" where status not in ('cancelled', 'returned')
     )
select
  coalesce((select sum(total_minor) from ev where at >= date_trunc('day', now())), 0)::bigint
    as revenue_today_minor,
  coalesce((select sum(total_minor) from ev where at >= date_trunc('day', now()) - interval '6 days'), 0)::bigint
    as revenue_7d_minor,
  coalesce((select sum(total_minor) from ev
             where at >= date_trunc('day', now()) - interval '13 days'
               and at <  date_trunc('day', now()) - interval '6 days'), 0)::bigint
    as revenue_prev_7d_minor,
  coalesce((select sum(total_minor) from ev where channel = 'pos'
             and at >= date_trunc('day', now()) - interval '6 days'), 0)::bigint
    as pos_revenue_7d_minor,
  coalesce((select sum(total_minor) from ev where channel = 'pos'
             and at >= date_trunc('day', now())), 0)::bigint
    as pos_revenue_today_minor,
  (select count(*) from app where at >= date_trunc('day', now()) - interval '6 days')::int
    as orders_7d,
  (select count(*) from app
     where at >= date_trunc('day', now()) - interval '13 days'
       and at <  date_trunc('day', now()) - interval '6 days')::int
    as orders_prev_7d,
  (select count(*) from ev where channel = 'pos'
     and at >= date_trunc('day', now()) - interval '6 days')::int
    as pos_sales_7d,
  (select count(*) from app where status = 'pending_payment')::int
    as pending_count,
  (select count(*) from app where status in ('confirmed', 'preparing'))::int
    as confirmed_count,
  (select count(*) from app where status = 'out_for_delivery')::int
    as out_for_delivery_count,
  (select count(*) from app
     where status = 'delivered' and at >= date_trunc('day', now()) - interval '6 days')::int
    as delivered_7d_count,
  (select coalesce(sum(qty), 0) from public.admin_revenue_event_item
     where at >= date_trunc('day', now()) - interval '6 days')::int
    as items_sold_7d,
  (select count(*) from public.inventory_item where qty_available <= reorder_point)::int
    as low_stock_count,
  (select count(*) from public.inventory_item where qty_available <= 0)::int
    as out_of_stock_count,
  (select count(*) from public.restock_subscription where status = 'active')::int
    as restock_waiting_count;
alter view public.admin_overview_stats set (security_invoker = on);

create or replace view public.admin_revenue_daily as
select
  d::date as day,
  coalesce(sum(ev.total_minor), 0)::bigint as revenue_minor
from generate_series(
       date_trunc('day', now()) - interval '6 days',
       date_trunc('day', now()),
       interval '1 day'
     ) as d
left join public.admin_revenue_event ev
  on ev.at >= d and ev.at < d + interval '1 day'
group by d
order by d;
alter view public.admin_revenue_daily set (security_invoker = on);

create or replace view public.admin_top_sellers as
select
  product_name_snapshot            as product_name,
  min(variant_label_snapshot)      as variant_label,
  sum(line_total_minor)::bigint    as revenue_minor
from public.admin_revenue_event_item
where at >= date_trunc('day', now()) - interval '6 days'
group by product_name_snapshot
order by revenue_minor desc
limit 5;
alter view public.admin_top_sellers set (security_invoker = on);

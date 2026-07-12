-- Admin stat views. The Overview and Orders pages previously selected whole
-- tables and aggregated in JavaScript; both now read one bounded row.
--
-- Status vocabulary is the check constraint on public."order".status
-- (20260616090002_schema.sql:323), which is the ONLY source of truth:
--   pending_payment, confirmed, preparing, out_for_delivery,
--   delivered, cancelled, returned
--
-- NOTE: the pages this replaces filtered on 'pending', 'cod_pending',
-- 'packing', 'ready', 'dispatched', and 'completed'. None of those can exist.
-- The Orders "pending" stat has therefore always read 0, and pending_payment
-- orders were counted in no bucket at all. These views fix that.

create or replace view public.admin_overview_stats as
with live as (
  select
    total_minor,
    status,
    coalesce(placed_at, created_at) as at
  from public."order"
  where status not in ('cancelled', 'returned')
)
select
  coalesce(sum(total_minor) filter (
    where at >= date_trunc('day', now())
  ), 0)::bigint as revenue_today_minor,

  coalesce(sum(total_minor) filter (
    where at >= date_trunc('day', now()) - interval '6 days'
  ), 0)::bigint as revenue_7d_minor,

  coalesce(sum(total_minor) filter (
    where at >= date_trunc('day', now()) - interval '13 days'
      and at <  date_trunc('day', now()) - interval '6 days'
  ), 0)::bigint as revenue_prev_7d_minor,

  count(*) filter (
    where at >= date_trunc('day', now()) - interval '6 days'
  )::int as orders_7d,

  count(*) filter (
    where at >= date_trunc('day', now()) - interval '13 days'
      and at <  date_trunc('day', now()) - interval '6 days'
  )::int as orders_prev_7d,

  count(*) filter (where status = 'pending_payment')::int
    as pending_count,
  count(*) filter (where status in ('confirmed', 'preparing'))::int
    as confirmed_count,
  count(*) filter (where status = 'out_for_delivery')::int
    as out_for_delivery_count,
  count(*) filter (
    where status = 'delivered'
      and at >= date_trunc('day', now()) - interval '6 days'
  )::int as delivered_7d_count,

  -- Uncorrelated scalar subqueries; legal beside aggregates.
  (select coalesce(sum(oi.qty), 0)
     from public.order_item oi
     join public."order" o on o.id = oi.order_id
    where o.status not in ('cancelled', 'returned')
      and coalesce(o.placed_at, o.created_at)
          >= date_trunc('day', now()) - interval '6 days')::int as items_sold_7d,

  (select count(*) from public.inventory_item
   where qty_available <= reorder_point)::int as low_stock_count,
  (select count(*) from public.inventory_item
   where qty_available <= 0)::int as out_of_stock_count,
  (select count(*) from public.restock_subscription
   where status = 'active')::int as restock_waiting_count
from live;

alter view public.admin_overview_stats set (security_invoker = on);

-- The 7-day trend line. generate_series guarantees a row per day even with
-- no orders, so the chart never collapses to fewer than 7 points.
create or replace view public.admin_revenue_daily as
select
  d::date as day,
  coalesce(sum(o.total_minor), 0)::bigint as revenue_minor
from generate_series(
       date_trunc('day', now()) - interval '6 days',
       date_trunc('day', now()),
       interval '1 day'
     ) as d
left join public."order" o
  on coalesce(o.placed_at, o.created_at) >= d
 and coalesce(o.placed_at, o.created_at) <  d + interval '1 day'
 and o.status not in ('cancelled', 'returned')
group by d
order by d;

alter view public.admin_revenue_daily set (security_invoker = on);

create or replace view public.admin_top_sellers as
select
  oi.product_name_snapshot            as product_name,
  min(oi.variant_label_snapshot)      as variant_label,
  sum(oi.line_total_minor)::bigint    as revenue_minor
from public.order_item oi
join public."order" o on o.id = oi.order_id
where o.status not in ('cancelled', 'returned')
  and coalesce(o.placed_at, o.created_at)
      >= date_trunc('day', now()) - interval '6 days'
group by oi.product_name_snapshot
order by revenue_minor desc
limit 5;

alter view public.admin_top_sellers set (security_invoker = on);

create or replace view public.admin_low_stock as
select
  p.name           as product_name,
  pv.size_ml,
  ii.qty_available
from public.inventory_item ii
join public.product_variant pv on pv.id = ii.variant_id
join public.product p         on p.id  = pv.product_id
where ii.qty_available <= ii.reorder_point
order by ii.qty_available asc
limit 4;

alter view public.admin_low_stock set (security_invoker = on);

create or replace view public.admin_restock_demand as
select
  p.name          as product_name,
  pv.size_ml,
  count(*)::int   as subscriber_count
from public.restock_subscription rs
join public.product_variant pv on pv.id = rs.variant_id
join public.product p         on p.id  = pv.product_id
where rs.status = 'active'
group by p.name, pv.size_ml
order by subscriber_count desc
limit 4;

alter view public.admin_restock_demand set (security_invoker = on);

-- The live queue: orders still needing the owner's attention.
create or replace view public.admin_order_queue as
select
  o.id,
  o.order_number,
  o.status,
  o.total_minor,
  coalesce(nullif(u.display_name, ''), 'Walk-in') as customer_name,
  coalesce(o.placed_at, o.created_at)             as placed_at
from public."order" o
left join public.app_user u on u.id = o.user_id
where o.status in ('pending_payment', 'confirmed', 'preparing', 'out_for_delivery')
order by coalesce(o.placed_at, o.created_at) desc
limit 5;

alter view public.admin_order_queue set (security_invoker = on);

create or replace view public.admin_order_stats as
select
  count(*) filter (where status = 'pending_payment')::int
    as pending_count,
  count(*) filter (where status in ('confirmed', 'preparing'))::int
    as confirmed_count,
  count(*) filter (where status = 'out_for_delivery')::int
    as out_for_delivery_count,
  count(*) filter (
    where status = 'delivered'
      and coalesce(placed_at, created_at) >= date_trunc('day', now()) - interval '6 days'
  )::int as delivered_7d_count,
  count(*) filter (where status in ('cancelled', 'returned'))::int
    as cancelled_count,
  coalesce(sum(total_minor) filter (
    where payment_method = 'cash_on_delivery'
      and status not in ('delivered', 'cancelled', 'returned')
  ), 0)::bigint as cod_to_collect_minor
from public."order";

alter view public.admin_order_stats set (security_invoker = on);

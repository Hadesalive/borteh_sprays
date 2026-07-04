-- 20260616090004_rls_policies.sql
-- Row Level Security per docs/06-data-model.md §13. RLS ON for every table.
-- Customer = own rows; staff/owner = full; rider = assigned jobs only.
-- Service-role (Edge Functions / crons) bypasses RLS for trusted server flows.

-- Enable RLS on every public table.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- ---------- Catalog: public read of active rows, staff full ----------
create policy cat_read_brand    on public.brand            for select to anon, authenticated using (is_active and deleted_at is null);
create policy cat_staff_brand   on public.brand            for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy cat_read_category on public.category         for select to anon, authenticated using (is_active and deleted_at is null);
create policy cat_staff_category on public.category        for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy cat_read_product  on public.product          for select to anon, authenticated using (is_active and deleted_at is null);
create policy cat_staff_product on public.product          for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy cat_read_variant  on public.product_variant  for select to anon, authenticated using (is_active and deleted_at is null);
create policy cat_staff_variant on public.product_variant  for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy cat_read_image    on public.product_image    for select to anon, authenticated using (true);
create policy cat_staff_image   on public.product_image    for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy cat_read_scent    on public.scent_note       for select to anon, authenticated using (true);
create policy cat_staff_scent   on public.scent_note       for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy cat_read_psn      on public.product_scent_note for select to anon, authenticated using (true);
create policy cat_staff_psn     on public.product_scent_note for all  to authenticated using (public.is_staff()) with check (public.is_staff());
create policy cat_read_store    on public.store_location   for select to anon, authenticated using (is_active);
create policy cat_staff_store   on public.store_location   for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy cat_read_zone     on public.delivery_zone    for select to anon, authenticated using (is_active);
create policy cat_staff_zone    on public.delivery_zone    for all    to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- Availability band: the only stock table customers may read ----------
create policy avail_read  on public.availability_signal for select to anon, authenticated using (true);
create policy avail_staff on public.availability_signal for all    to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- Inventory exact numbers + ledger: staff only ----------
create policy inv_staff    on public.inventory_item for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy ledger_staff on public.stock_ledger   for select to authenticated using (public.is_staff());

-- ---------- Users ----------
create policy user_self_read  on public.app_user for select to authenticated using (id = auth.uid());
create policy user_self_write on public.app_user for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy user_staff      on public.app_user for all    to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- Delivery locations (own) ----------
create policy loc_own   on public.delivery_location for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy loc_staff on public.delivery_location for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- Riders ----------
create policy rider_self  on public.rider for select to authenticated using (user_id = auth.uid());
create policy rider_upd   on public.rider for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy rider_staff on public.rider for all    to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- Wishlist / Cart (own) ----------
create policy wl_own    on public.wishlist for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy wl_staff  on public.wishlist for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy wli_own   on public.wishlist_item for all to authenticated
  using (exists (select 1 from public.wishlist w where w.id = wishlist_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.wishlist w where w.id = wishlist_id and w.user_id = auth.uid()));
create policy wli_staff on public.wishlist_item for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy cart_own   on public.cart for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_staff on public.cart for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy ci_own   on public.cart_item for all to authenticated
  using (exists (select 1 from public.cart c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.cart c where c.id = cart_id and c.user_id = auth.uid()));
create policy ci_staff on public.cart_item for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- Promo codes: validated via RPC; staff manage ----------
create policy promo_staff on public.promo_code for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- Orders (own read; insert via service-role checkout; rider sees assigned) ----------
create policy order_own   on public."order" for select to authenticated using (user_id = auth.uid());
create policy order_staff on public."order" for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy order_rider on public."order" for select to authenticated using (
  exists (select 1 from public.delivery_job dj join public.rider r on r.id = dj.rider_id
          where dj.order_id = "order".id and r.user_id = auth.uid()));

create policy oi_own   on public.order_item for select to authenticated using (
  exists (select 1 from public."order" o where o.id = order_id and o.user_id = auth.uid()));
create policy oi_staff on public.order_item for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy oi_rider on public.order_item for select to authenticated using (
  exists (select 1 from public.delivery_job dj join public.rider r on r.id = dj.rider_id
          where dj.order_id = order_item.order_id and r.user_id = auth.uid()));

create policy osh_own   on public.order_status_history for select to authenticated using (
  exists (select 1 from public."order" o where o.id = order_id and o.user_id = auth.uid()));
-- append-only: staff may read + insert transitions, never UPDATE/DELETE (audit H1)
create policy osh_staff_read   on public.order_status_history for select to authenticated using (public.is_staff());
create policy osh_staff_insert on public.order_status_history for insert to authenticated with check (public.is_staff());

-- ---------- Payments ----------
create policy pi_own   on public.payment_intent for select to authenticated using (
  exists (select 1 from public."order" o where o.id = order_id and o.user_id = auth.uid()));
create policy pi_staff on public.payment_intent for select to authenticated using (public.is_staff());
create policy pw_staff on public.payment_webhook for select to authenticated using (public.is_staff());
create policy rf_own   on public.refund for select to authenticated using (
  exists (select 1 from public."order" o where o.id = order_id and o.user_id = auth.uid()));
create policy rf_staff on public.refund for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- Delivery jobs (rider own; staff all) ----------
create policy dj_rider on public.delivery_job for select to authenticated using (
  exists (select 1 from public.rider r where r.id = rider_id and r.user_id = auth.uid()));
create policy dj_rider_upd on public.delivery_job for update to authenticated using (
  exists (select 1 from public.rider r where r.id = rider_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.rider r where r.id = rider_id and r.user_id = auth.uid()));
create policy dj_staff on public.delivery_job for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- Engagement ----------
create policy rs_own   on public.restock_subscription for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy rs_staff on public.restock_subscription for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy rev_read   on public.review for select to anon, authenticated using (status = 'published' or user_id = auth.uid());
create policy rev_insert on public.review for insert to authenticated with check (user_id = auth.uid());
create policy rev_update on public.review for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy rev_staff  on public.review for all    to authenticated using (public.is_staff()) with check (public.is_staff());

create policy notif_own   on public.notification for select to authenticated using (user_id = auth.uid());
create policy notif_upd   on public.notification for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_staff on public.notification for all    to authenticated using (public.is_staff()) with check (public.is_staff());

create policy np_own   on public.notification_preference for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy np_staff on public.notification_preference for select to authenticated using (public.is_staff());

-- ---------- Loyalty & promos (read offers/own state; staff manage) ----------
create policy lc_read  on public.loyalty_config for select to authenticated using (true);
create policy lc_staff on public.loyalty_config for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy lt_read  on public.loyalty_tier   for select to authenticated using (true);
create policy lt_staff on public.loyalty_tier   for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy pr_read  on public.promo_rule     for select to authenticated using (is_active);
create policy pr_staff on public.promo_rule     for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy la_own   on public.loyalty_account for select to authenticated using (user_id = auth.uid());
create policy la_staff on public.loyalty_account for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy ll_own   on public.loyalty_ledger for select to authenticated using (user_id = auth.uid());
create policy ll_staff on public.loyalty_ledger for select to authenticated using (public.is_staff()); -- append-only: no UPDATE/DELETE (audit C2)

-- ---------- Analytics (insert own/anon; staff read) ----------
create policy ae_insert on public.analytics_event for insert to anon, authenticated with check (user_id = auth.uid() or user_id is null);
create policy ae_staff  on public.analytics_event for select to authenticated using (public.is_staff());

-- ---------- Optional in-app messaging (v1.5) ----------
create policy conv_own   on public.conversation for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy conv_staff on public.conversation for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy msg_own    on public.message for all to authenticated
  using (exists (select 1 from public.conversation c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.conversation c where c.id = conversation_id and c.user_id = auth.uid()));
create policy msg_staff  on public.message for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- =====================================================================
-- Table privileges (audit C1) — THE deploy blocker.
-- RLS above is the row-level gate; PostgREST/Realtime still need table-level grants,
-- or every catalog read / customer query / subscription returns "permission denied".
-- Broad grants are safe because RLS decides which ROWS each role actually sees.
-- =====================================================================
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;  -- still gated by RLS
grant insert on public.analytics_event to anon;                                -- anonymous telemetry
alter default privileges in schema public grant select on tables to anon, authenticated;

-- Enforce append-only at the grant layer too (defense-in-depth; audit C2/H1/M2).
-- These ledgers are INSERT-only — even a buggy service-role caller must not rewrite history.
-- (payment_webhook is intentionally NOT here: its processed/verified flags are updated after insert.
--  analytics_event is left mutable for a future retention/pruning job.)
revoke update, delete on public.loyalty_ledger       from anon, authenticated, service_role;
revoke update, delete on public.order_status_history from anon, authenticated, service_role;
revoke update, delete on public.stock_ledger         from anon, authenticated, service_role;

# Borteh Sprays 001 — Database Audit

Scope: pre-deploy review of the Supabase/Postgres schema (5 SQL files: 4 migrations + seed) against `docs/06-data-model.md`. Date: 2026-06-17.

---

## 0. STATUS — 2026-06-17: Critical + High RESOLVED ✓

All **5 Critical + 10 High** findings were fixed in place (migrations not yet deployed) and **re-verified green** by a 4-member council (RPC/concurrency · RLS+grants · migration-safety · money) — **0 regressions**. A follow-up idempotency nit (the subtotal constraint trigger) was also fixed.

| Resolved | Items |
|---|---|
| Critical | C1, C2, C3, C4, C5 |
| High | H1, H2, H3, H4, H5, H6, H7, H8, H9, H10 |

The **13 Medium + 2 Low** findings below remain open and documented — they are **post-push hardening**, not blockers.

**Updated verdict: READY TO PUSH.** Once Supabase credentials are provided, `supabase db push` applies the schema; the mediums/lows can follow.

---

## 1. Executive summary

**Overall risk verdict: NOT READY TO DEPLOY — fix the Critical block first.**

The schema is, structurally, a strong and faithful implementation of the data model: money is integer `bigint` minor units everywhere, enums are `text + CHECK`, the `"order"` reserved word is correctly quoted, the loyalty config singleton, the two‑dimension stock ledger, payment idempotency anchors, and the customer/staff/rider RLS split are all done well. The locking in the two hottest RPCs (`fn_reserve_stock`, `fn_sell_instore`) is correct.

However, there is a cluster of issues that will either break the app on first request or silently corrupt money/inventory/audit data:

- **One hard deployment blocker**: no table‑level `GRANT`s for `anon`/`authenticated`, so PostgREST/Realtime may return `permission denied` for every query (depends on the project's default privileges — must be verified or made explicit).
- **Append‑only is not actually enforced**: the `loyalty_ledger` and `order_status_history` RLS policies use `for all`, letting staff `UPDATE`/`DELETE` the immutable financial and audit ledgers — directly contradicting `06-data-model.md` §2/§13.
- **Money has no arithmetic integrity**: nothing forces `line_total = unit_price × qty`, `subtotal = Σ line_total`, payment/COD amounts to match the order total, or refunds to stay within the order total.
- **Inventory RPCs can double‑apply**: `fn_confirm_sale_online` / `fn_release_reservation` have no idempotency guard (webhook + expiry sweep both fire), and `fn_release_reservation` uses `GREATEST(...,0)` that silently clamps the balance while still writing the full delta to the append‑only ledger — permanently breaking the reconstruction invariant.
- **Soft delete is defeated** by `UNIQUE` constraints on `slug`/`sku`/`barcode` that don't exclude deleted rows.

### Counts by severity

| Severity | Count |
|---|---|
| Critical | 5 |
| High | 10 |
| Medium | 13 |
| Low | 2 |
| **Total** | **30** |

### Highest‑priority issues

1. No `GRANT SELECT`/`USAGE` for `anon`/`authenticated` → PostgREST + Realtime `permission denied` (whole app).
2. `loyalty_ledger` (Critical) and `order_status_history` (High) RLS `for all` lets staff mutate/erase append‑only audit & financial ledgers.
3. `fn_confirm_sale_online`/`fn_release_reservation`: no idempotency guard + `GREATEST` clamp corrupts the stock ledger.
4. `order_item.line_total_minor` and `order.subtotal_minor` have no arithmetic constraint feeding `ck_order_total`.
5. Soft delete + `UNIQUE(slug/sku/barcode)` blocks re‑creating a deleted product/brand/variant.
6. `seed.sql` + trigger/policy DDL are non‑idempotent → `supabase db reset` doubles stock; re‑apply fails.

---

## 2. CRITICAL

### C1. No table‑level GRANTs for `anon`/`authenticated` — every PostgREST/Realtime query may fail
**Severity:** Critical · **Lens:** Supabase platform correctness
**Location:** all migrations (no `GRANT` on tables anywhere; only function `execute` grants exist at `20260616090003_functions_triggers.sql:230‑249`).

**Issue.** RLS policies are defined for `anon`/`authenticated` across every table, but RLS only *filters* rows — it does not *grant* table access. There is no `GRANT USAGE ON SCHEMA public`, no `GRANT SELECT ON ... TO anon, authenticated`, and no `ALTER DEFAULT PRIVILEGES`. The app is therefore relying entirely on the project's Supabase default privileges. On older Supabase projects those defaults grant `anon`/`authenticated` access to new `public` tables; newer projects have tightened this, and if migrations run as a role without those configured default privileges, **every catalog read, every customer query, and every Realtime subscription returns `permission denied`.** This must be verified against the target project; the safe, idempotent fix is to be explicit.

**Fix.** Add (and pair with the append‑only revoke from C2):
```sql
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated; -- still gated by RLS
grant insert on public.analytics_event to anon;                              -- anon telemetry
alter default privileges in schema public grant select on tables to anon, authenticated;
```

---

### C2. Append‑only `loyalty_ledger` allows staff UPDATE/DELETE (`for all` RLS)
**Severity:** Critical · **Lenses:** RLS & authorization; Data lifecycle & append‑only
**Location:** `20260616090004_rls_policies.sql:136` (`ll_staff`); table `20260616090002_schema.sql:599‑610`.

**Issue.** `create policy ll_staff on public.loyalty_ledger for all to authenticated using (public.is_staff()) ...` grants SELECT/INSERT/**UPDATE/DELETE**. `06-data-model.md` §2 (line 110) and §13 (line 1398) require `loyalty_ledger` to be append‑only with UPDATE/DELETE revoked. The ledger is the source of truth for points (`loyalty_account.points_balance == SUM(loyalty_ledger.delta)`, doc line 1290). Staff being able to edit/delete individual earn/redeem rows breaks the balance invariant and is a fraud vector. The table correctly omits `updated_at`, confirming append‑only intent; only the policy is wrong. Writes are meant to come from a service‑role RPC, which bypasses RLS.

**Fix.**
```sql
drop policy ll_staff on public.loyalty_ledger;
create policy ll_staff on public.loyalty_ledger
  for select to authenticated using (public.is_staff());
-- INSERTs happen via service-role (bypasses RLS). Also revoke at the grant layer:
revoke update, delete on public.loyalty_ledger from anon, authenticated, service_role;
```

---

### C3. Inventory RPCs `fn_confirm_sale_online` / `fn_release_reservation` — no idempotency guard, and `GREATEST` silently corrupts the ledger
**Severity:** Critical · **Lens:** Concurrency, oversell & inventory RPCs
**Location:** `20260616090003_functions_triggers.sql:130‑145` (confirm) and `:148‑161` (release; `GREATEST` at `:153`).

**Issue.** Two distinct, compounding defects:

1. **No idempotency guard (both functions).** The design explicitly warns of "double‑apply risk if a webhook + sweep both fire" (doc §8.1). The payment webhook handler and the reservation‑expiry sweep can both call confirm (or release) for the same order. Neither RPC checks `payment_intent.status` nor any `stock_confirmed_at`/`stock_released_at` marker, so a second call applies again.
2. **`GREATEST(qty_reserved - p_qty, 0)` masks over‑release (release).** If `p_qty > qty_reserved`, the balance clamps to 0 but the ledger still inserts `qty_reserved_delta = -p_qty`. This permanently breaks the documented reconstruction invariant `SUM(qty_reserved_delta) == inventory_item.qty_reserved` (ADR‑010) — and because nothing is raised, the operator never sees it. On a double‑release the second call silently writes another `-p_qty` ledger row against an already‑zero balance.

> Note (precision): `fn_confirm_sale_online` uses an atomic in‑place `SET qty = qty - p_qty`, so it does **not** suffer the classic "both read 10, both write 5" lost update — the real danger is *double‑apply* and ledger corruption, not a torn read. The fix is a guard + validation, plus a `FOR UPDATE` read to match the documented pattern (doc line 102).

**Fix (release shown; apply the same row‑lock + validation shape to confirm, and add an order‑level idempotency marker):**
```sql
create or replace function public.fn_release_reservation(
  p_variant uuid, p_qty int, p_order uuid, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_on int; v_res int;
begin
  select qty_on_hand, qty_reserved into v_on, v_res
    from public.inventory_item where variant_id = p_variant for update;
  if not found then raise exception 'inventory_item missing for variant %', p_variant; end if;
  if v_res < p_qty then
    raise exception 'cannot release % units; only % reserved (variant %)', p_qty, v_res, p_variant;
  end if;
  update public.inventory_item
     set qty_reserved = qty_reserved - p_qty, updated_at = now()
   where variant_id = p_variant
   returning qty_on_hand, qty_reserved into v_on, v_res;
  insert into public.stock_ledger(variant_id, movement_type, qty_delta, qty_reserved_delta,
      balance_after, reserved_after, reference_type, reference_id, created_by)
    values (p_variant, 'release', 0, -p_qty, v_on, v_res, 'order', p_order, p_actor);
  perform public.fn_recompute_band(p_variant);
end; $$;
```
For idempotency, gate both flows on an order‑level marker so the sweep and the webhook can't both apply, e.g. add `order.stock_settled_at timestamptz` (or check `payment_intent.status IN ('created','processing')` inside a wrapping service‑role RPC that both callers use) and skip if already set.

---

### C4. `order_item.line_total_minor` is not constrained to `unit_price_minor × qty`
**Severity:** Critical · **Lens:** Money & financial integrity
**Location:** `20260616090002_schema.sql:367`.

**Issue.** `line_total_minor` only has `>= 0`. Because `order.subtotal_minor` is meant to be `Σ line_total_minor`, and `ck_order_total` (line 349‑350) derives `total_minor` from `subtotal_minor`, a wrong line total silently corrupts the whole money chain with no guard rail.

**Fix.**
```sql
alter table public.order_item
  add constraint ck_order_item_line_total
  check (line_total_minor = unit_price_minor * qty);
```

---

### C5. `order.subtotal_minor` is not constrained to `Σ order_item.line_total_minor`
**Severity:** Critical · **Lens:** Money & financial integrity
**Location:** `20260616090002_schema.sql:331` (with `ck_order_total` at `:349‑350`).

**Issue.** `subtotal_minor` only has `>= 0`. `ck_order_total` trusts it blindly, so a miscalculated subtotal (rounding, a dropped line item) yields a "valid" but wrong total. A `CHECK` cannot reference child rows, so this needs a deferred constraint trigger (items are inserted after the order row).

**Fix.**
```sql
create or replace function public.fn_assert_order_subtotal()
returns trigger language plpgsql set search_path = public as $$
declare v_sum bigint;
begin
  select coalesce(sum(line_total_minor),0) into v_sum
    from public.order_item where order_id = new.id;
  if new.subtotal_minor <> v_sum then
    raise exception 'subtotal_minor % <> sum(line_total) % for order %',
      new.subtotal_minor, v_sum, new.id;
  end if;
  return null;
end; $$;

create constraint trigger trg_order_subtotal
  after insert or update on public."order"
  deferrable initially deferred
  for each row execute function public.fn_assert_order_subtotal();
```

---

## 3. HIGH

### H1. Append‑only `order_status_history` allows staff UPDATE/DELETE (`for all` RLS)
**Severity:** High · **Lenses:** RLS & authorization; Data lifecycle
**Location:** `20260616090004_rls_policies.sql:91` (`osh_staff`); table `20260616090002_schema.sql:372‑381`.

**Issue.** Same defect class as C2 on the order status audit trail. `for all` lets staff rewrite/erase status history; doc §2/§13 mark it append‑only. Staff legitimately need INSERT (logging transitions) but never UPDATE/DELETE.

**Fix.**
```sql
drop policy osh_staff on public.order_status_history;
create policy osh_staff_read   on public.order_status_history for select to authenticated using (public.is_staff());
create policy osh_staff_insert on public.order_status_history for insert to authenticated with check (public.is_staff());
revoke update, delete on public.order_status_history from anon, authenticated, service_role;
```

### H2. Delivery address snapshots are nullable for delivery orders
**Severity:** High · **Lens:** Constraints & referential integrity
**Location:** `20260616090002_schema.sql:326‑330` (snapshots) and `:351‑352` (`ck_order_delivery_target`).

**Issue.** `landmark_snapshot` / `contact_phone_snapshot` are nullable. They exist precisely so a rider has the drop‑off even if the source `delivery_location` later changes/deletes (doc §7, lines 753‑758). `ck_order_delivery_target` requires the *FK* on delivery orders but not the snapshots, so a delivery order can be created with no captured address. `order_item` snapshots are already `NOT NULL` by precedent.

**Fix.**
```sql
alter table public."order"
  add constraint ck_order_delivery_snapshot
  check (fulfillment_type = 'pickup'
         or (landmark_snapshot is not null and contact_phone_snapshot is not null));
```

### H3. Soft delete defeated by `UNIQUE` on `slug`/`sku`/`barcode`
**Severity:** High · **Lens:** Schema design & normalization
**Location:** `20260616090002_schema.sql:15` (brand.slug), `:28` (category.slug), `:42` (product.slug), `:69` (variant.sku), `:70` (variant.barcode).

**Issue.** These `UNIQUE`s don't exclude `deleted_at IS NOT NULL`. A soft‑deleted row keeps occupying its slug/sku/barcode, so re‑creating it fails with a duplicate‑key error — defeating soft delete (ADR‑003, doc line 108). RLS already hides deleted rows, but Postgres enforces `UNIQUE` before RLS.

**Fix** (constraint names are Postgres defaults — confirm with `\d`):
```sql
alter table public.brand           drop constraint brand_slug_key;
alter table public.category        drop constraint category_slug_key;
alter table public.product         drop constraint product_slug_key;
alter table public.product_variant drop constraint product_variant_sku_key;
alter table public.product_variant drop constraint product_variant_barcode_key;
create unique index uq_brand_slug      on public.brand           (slug)    where deleted_at is null;
create unique index uq_category_slug   on public.category        (slug)    where deleted_at is null;
create unique index uq_product_slug    on public.product         (slug)    where deleted_at is null;
create unique index uq_variant_sku     on public.product_variant (sku)     where deleted_at is null;
create unique index uq_variant_barcode on public.product_variant (barcode) where deleted_at is null and barcode is not null;
```

### H4. `payment_intent.amount_minor` not tied to `order.total_minor`
**Severity:** High · **Lens:** Money & financial integrity
**Location:** `20260616090002_schema.sql:393`.

**Issue.** Only `>= 0`. A payment can be recorded for an amount different from the order total → reconciliation mismatch. Subtlety: `order.total_minor` can change after intent creation when the owner confirms `delivery_fee_minor` (ADR‑013, doc line 825), so validate **at creation** and require Monime intents to be created only after the fee is confirmed.

**Fix.**
```sql
create or replace function public.fn_assert_intent_amount()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.amount_minor <> (select total_minor from public."order" where id = new.order_id) then
    raise exception 'payment_intent.amount_minor % <> order.total_minor for order %',
      new.amount_minor, new.order_id;
  end if;
  return new;
end; $$;
create trigger trg_intent_amount before insert on public.payment_intent
  for each row execute function public.fn_assert_intent_amount();
```

### H5. `delivery_job.cod_expected_minor` not tied to `order.total_minor`
**Severity:** High · **Lens:** Money & financial integrity
**Location:** `20260616090002_schema.sql:463`.

**Issue.** Only `>= 0`. The doc (line 1093) says it is copied from `order.total_minor` for COD orders, but nothing enforces it. The rider is the cash interface, so a mismatch means collecting the wrong amount with no DB guard.

**Fix.** Trigger on `delivery_job` INSERT/UPDATE: for COD orders, assert `cod_expected_minor = (select total_minor from "order" where id = order_id)`.

### H6. `refund.amount_minor` is uncapped — refunds can exceed the order total
**Severity:** High · **Lens:** Money & financial integrity
**Location:** `20260616090002_schema.sql:436`.

**Issue.** Only `> 0`. No check that one refund ≤ order total, nor that the sum of refunds for an order ≤ order total. Even a manual reconciliation workflow must not allow refunding more than was paid.

**Fix.** Trigger on `refund` INSERT/UPDATE:
```sql
-- per order: SUM(amount_minor) over non-failed refunds must stay <= order.total_minor
create or replace function public.fn_assert_refund_cap()
returns trigger language plpgsql set search_path = public as $$
declare v_total bigint; v_sum bigint;
begin
  select total_minor into v_total from public."order" where id = new.order_id;
  select coalesce(sum(amount_minor),0) into v_sum from public.refund
    where order_id = new.order_id and status <> 'failed' and id <> new.id;
  if v_sum + new.amount_minor > v_total then
    raise exception 'refunds (% ) would exceed order total % for order %',
      v_sum + new.amount_minor, v_total, new.order_id;
  end if;
  return new;
end; $$;
create trigger trg_refund_cap before insert or update on public.refund
  for each row execute function public.fn_assert_refund_cap();
```

### H7. `reorder_point DEFAULT 0` makes the `'low'` band unreachable → low‑stock cron never fires
**Severity:** High · **Lens:** Data lifecycle & operations
**Location:** `20260616090002_schema.sql:156` (default) and `20260616090003_functions_triggers.sql:79‑81` (band CASE); index `:162‑163`.

**Issue.** The band logic is `WHEN avail <= 0 THEN 'out' WHEN avail <= reorder_point THEN 'low' ELSE 'in_stock'`. With `reorder_point = 0`, the second branch is `avail <= 0`, which the first branch already caught — so `'low'` is mathematically unreachable and the partial low‑stock index (same predicate) only ever matches out‑of‑stock items. The CASE itself is correct once `reorder_point > 0`; the defect is the default silently disabling the low‑stock safety feature until the owner tunes every variant.

**Fix.** Ship a sane default and backfill, and make per‑variant tuning part of admin onboarding:
```sql
alter table public.inventory_item alter column reorder_point set default 5;
update public.inventory_item set reorder_point = 5 where reorder_point = 0;
```

### H8. Trigger creation block is not idempotent
**Severity:** High · **Lens:** Migration safety, ordering & idempotency
**Location:** `20260616090003_functions_triggers.sql:29‑44`.

**Issue.** The `DO` loop builds ~29 `updated_at` triggers with `EXECUTE FORMAT('create trigger ...')` and no guard. Re‑running migration 3 (or `supabase db reset` against an existing DB) fails with "trigger already exists". (There is no `CREATE TRIGGER IF NOT EXISTS` in Postgres — but this project is PG17, so `CREATE OR REPLACE TRIGGER` is available.)

**Fix.**
```sql
execute format(
  'create or replace trigger trg_%s_updated before update on public.%I '
  'for each row execute function public.set_updated_at()', t, t);
```

### H9. `seed.sql` stock seeding is not idempotent — `db reset` doubles inventory
**Severity:** High · **Lens:** Migration safety & idempotency
**Location:** `seed.sql:82‑88`.

**Issue.** Every other seed insert uses `on conflict do nothing`, but the stock loop calls `fn_receive_stock(v.id, 25, …)` unconditionally. `supabase db reset` re‑runs the seed, so each run adds 25 more units and appends duplicate `'seed'` rows to the **append‑only** `stock_ledger` — permanent audit corruption and wrong balances/bands.

**Fix.**
```sql
do $$
declare v record;
begin
  for v in select id from public.product_variant loop
    if not exists (select 1 from public.stock_ledger where variant_id = v.id and reason = 'seed') then
      perform public.fn_receive_stock(v.id, 25, null, 'seed');
    end if;
  end loop;
end $$;
```

### H10. `loyalty_ledger.user_id` is used in RLS but has no index
**Severity:** High · **Lens:** Indexing & query performance
**Location:** RLS `20260616090004_rls_policies.sql:135` (`using (user_id = auth.uid())`); only index is `idx_loyalty_ledger_acct (account_id, created_at)` at `20260616090002_schema.sql:610`.

**Issue.** Every customer read of their loyalty history filters `loyalty_ledger` by `user_id`, which is unindexed, forcing a sequential scan on an append‑only, monotonically growing table. One‑line fix that also enables keyset pagination.

**Fix.**
```sql
create index idx_loyalty_ledger_user on public.loyalty_ledger (user_id, created_at);
```

---

## 4. MEDIUM

### M1. `order.delivery_location_id` / `delivery_zone_id` missing `ON DELETE SET NULL` (and the CHECK interaction)
**Lens:** Constraints & RI · **Location:** `20260616090002_schema.sql:323‑324`.
Both FKs default to `RESTRICT`, blocking hard‑deletion/cleanup of locations/zones referenced by historical orders even though snapshots preserve the data. **Important:** simply switching `delivery_location_id` to `ON DELETE SET NULL` is a no‑op for delivery orders — the cascade `SET NULL` is an UPDATE that re‑evaluates `ck_order_delivery_target` (which requires the FK non‑null for delivery), so the delete still fails. Do it coherently: make snapshots `NOT NULL` (H2), retarget the CHECK to the snapshot, then allow `SET NULL`.
```sql
alter table public."order" drop constraint ck_order_delivery_target;
alter table public."order" add constraint ck_order_delivery_target
  check (fulfillment_type = 'pickup' or landmark_snapshot is not null);
alter table public."order"
  drop constraint "order_delivery_location_id_fkey",
  add constraint order_delivery_location_id_fkey
    foreign key (delivery_location_id) references public.delivery_location(id) on delete set null;
alter table public."order"
  drop constraint "order_delivery_zone_id_fkey",
  add constraint order_delivery_zone_id_fkey
    foreign key (delivery_zone_id) references public.delivery_zone(id) on delete set null;
```

### M2. Append‑only tables not revoked from `service_role`; v1.5 `message` policies use `for all`
**Lenses:** Supabase platform; RLS · **Location:** append‑only tables (`stock_ledger`, `order_status_history`, `loyalty_ledger`, `payment_webhook`, `analytics_event`); `message` policies `20260616090004_rls_policies.sql:145‑148`.
RLS blocks UPDATE/DELETE for app roles (once C2/H1 are fixed), but **service‑role bypasses RLS** — a buggy Edge Function can still mutate history. Defense‑in‑depth: revoke at the grant layer (see snippet in C1/C2). Separately, the deferred `message` table uses `for all` though the design says messages aren't edited (doc line 1343) — restrict `msg_own` to `select, insert` and `msg_staff` to `select` before v1.5 is activated.

### M3. Duplicate `auth.users` insert trigger vs Supabase's default `handle_new_user`
**Lens:** Supabase platform · **Location:** `20260616090003_functions_triggers.sql:64‑66`.
`trg_auth_user_created` fires on `auth.users` INSERT. Many Supabase projects ship a default `on_auth_user_created` trigger that inserts into `public.users`. If both exist, both run on signup. `on conflict (id) do nothing` protects `app_user` integrity, but you get redundant work and possibly orphan `public.users` rows. Before deploy, query `information_schema.triggers` for `auth.users` and drop/consolidate.

### M4. `promo_code.discount_value` / `promo_rule.discount_value` are `int`, not `bigint`
**Lens:** Money · **Location:** `20260616090002_schema.sql:296` and `:560`.
The column means a percent (0–100) when `discount_type='percent'` but SLE **minor units** when `'fixed'`. `int` caps fixed discounts at ~Le 21.4M and breaks the "money is `bigint` minor units" convention. Prefer splitting into `discount_percent int` + `discount_fixed_minor bigint` with a mutual‑exclusivity CHECK, or at minimum widen to `bigint`.

### M5. `promo_code.usage_limit` not enforced against `usage_count`
**Lens:** Money · **Location:** `20260616090002_schema.sql:299‑300`.
A code can be redeemed past its limit (the atomic check must also live in the checkout RPC under `SELECT … FOR UPDATE`). Add a backstop:
```sql
alter table public.promo_code
  add constraint ck_promo_usage check (usage_limit is null or usage_count <= usage_limit);
```

### M6. Ledger `balance_after` snapshots are unvalidated (and nullable on the stock ledger)
**Lens:** Money · **Location:** `stock_ledger.balance_after/reserved_after` `:173‑174`; `loyalty_ledger.balance_after` `:606`.
`stock_ledger.balance_after`/`reserved_after` are nullable and only filled by the RPCs — and as noted in M9 a missing inventory row writes NULLs. `loyalty_ledger.balance_after` is `NOT NULL` but never checked to equal `account.points_balance + delta`. Make the stock snapshots `NOT NULL` once M9's row‑existence guard lands, and validate `loyalty_ledger.balance_after` inside the (sole) service‑role loyalty RPC.

### M7. No CHECK that COD intents keep `provider_intent_id` NULL
**Lens:** Payments & Monime · **Location:** `20260616090002_schema.sql:386‑407`.
Doc §8.2 (line 992): COD intents use a synthetic `idempotency_key` and `provider_intent_id` stays NULL (no Monime call). Nothing prevents a Monime `scs-…` id on a COD row.
```sql
alter table public.payment_intent
  add constraint ck_cod_no_provider_id
  check (provider <> 'cash_on_delivery' or provider_intent_id is null);
```

### M8. Deadlock risk on multi‑item orders (no canonical lock ordering / retry)
**Lens:** Concurrency · **Location:** `fn_reserve_stock` `20260616090003_functions_triggers.sql:108‑127`, called per‑item by checkout.
The design's single `reserve_for_order(items[])` RPC does not exist; checkout calls per‑item `fn_reserve_stock`, each taking `FOR UPDATE`. Two concurrent multi‑item orders locking variants in different order (A→B vs B→A) deadlock (Postgres aborts one with `40P01`). Mitigate: sort variant ids ascending before reserving, or add a single multi‑item RPC that locks in sorted order, and add bounded retry on `40P01` in the Edge Function.

### M9. Inventory mutators lack a row‑existence check; inconsistent return types; misleading comment
**Lens:** Concurrency · **Location:** `fn_confirm_sale_online`/`fn_release_reservation`/`fn_receive_stock`/`fn_adjust_stock`/`fn_return_stock` `:130‑226`; comment `:102`.
For a non‑existent/soft‑gone variant, the bare `UPDATE` affects 0 rows, `RETURNING` yields NULL, and the append‑only ledger gets `balance_after = NULL`. Add `IF NOT FOUND` / `IF v_on IS NULL THEN RAISE` to every mutator. Return types are inconsistent (`fn_reserve_stock`/`fn_sell_instore` return `boolean`; the rest `void`), so callers can't detect failure — standardize on raising exceptions for operational failures. Finally, the comment at line 102 ("All lock the inventory_item row (FOR UPDATE)") is false — only 2 of 7 do; correct it (or, better, add `FOR UPDATE` per C3). *(Note: `fn_return_stock` already validates `p_qty > 0` at line 218 — the only missing piece there is the row‑existence check.)*

### M10. RLS policy creation and the deferred FK add are not idempotent
**Lens:** Migration safety · **Location:** policies `20260616090004_rls_policies.sql:17‑148`; FK `20260616090002_schema.sql:229‑232`.
There is no `CREATE OR REPLACE POLICY` / `IF NOT EXISTS` for policies, and `ALTER TABLE … ADD CONSTRAINT` is not idempotent. Re‑applying these migrations (or running against a partially‑built DB) errors. Not a blocker for a clean one‑shot push, but it breaks re‑runs/`db reset`. Wrap policy creation in `drop policy if exists … ; create policy …`, and wrap the FK add in `exception when duplicate_object then null`.

### M11. `order_status_history` and `order_item` use `ON DELETE CASCADE` — latent audit/financial loss
**Lens:** Data lifecycle · **Location:** `20260616090002_schema.sql:360` (order_item) and `:374` (order_status_history).
Order deletion is currently blocked by `RESTRICT` on `payment_intent` (:388) and `refund` (:434), so cascade is dormant — but if those are ever relaxed, the only audit trail of status transitions and the financial line items vanish silently. Change both to `ON DELETE RESTRICT`; if logical order removal is ever needed, do it via a `deleted_at` flag, not a hard delete.

### M12. `analytics_event` has no retention/partitioning or documented SOP
**Lens:** Data lifecycle · **Location:** `20260616090002_schema.sql:615‑629`.
High‑volume by design (doc §11.6) but unbounded. Deferring partitioning for v1 is an accepted design decision (doc §11.6 "revisit when volume warrants"); the real gap is that no retention/maintenance SOP is captured anywhere in the deploy artifacts. Add a retention cron (e.g., delete `occurred_at < now() - 90 days`) or document the manual partition/archive threshold in the deployment runbook. The `(event_type, occurred_at)` / `(user_id, occurred_at)` indexes are fine for v1.

### M13. `cart.user_id` has only a partial (active‑cart) index
**Lens:** Indexing · **Location:** partial unique index `20260616090002_schema.sql:274`; RLS `:65‑66`.
`uq_cart_active (user_id) WHERE status='active'` enforces one active cart but does not cover RLS reads of non‑active carts (history/admin). Minor; if such queries appear, add a plain `create index idx_cart_user on public.cart (user_id);`. Otherwise document that carts are accessed by `cart_id`.

---

## 5. LOW

### L1. `payment_webhook.match_method` has no CHECK
**Lens:** Payments · **Location:** `20260616090002_schema.sql:422`.
Doc §8.1 defines exactly `'metadata' | 'object_id' | 'ownership_graph'`. Constrain to catch typos:
```sql
alter table public.payment_webhook
  add constraint ck_match_method
  check (match_method is null or match_method in ('metadata','object_id','ownership_graph'));
```

### L2. Refund management granted to all staff, not owner‑only
**Lens:** Payments / RLS · **Location:** `20260616090004_rls_policies.sql:100` (`rf_staff` uses `is_staff()` = staff+owner).
If money‑out (refunds) is meant to be owner‑only, `rf_staff`'s `for all` is too broad. Confirm intent; if owner‑only, gate the write side on `current_app_role() = 'owner'`.

---

## 6. Recommended fix order

### Before first push (blockers + cheap‑but‑critical data integrity)
- [ ] **C1** Add `GRANT USAGE/SELECT` (+ DML) for `anon`/`authenticated` — verify against the target project first.
- [ ] **C2 / H1** Change `loyalty_ledger` + `order_status_history` RLS from `for all` to `select` (+`insert` for OSH); `REVOKE update, delete` on all five append‑only tables (incl. **M2** service‑role revoke).
- [ ] **C3** Add idempotency guard + remove `GREATEST`/validate in `fn_release_reservation` and `fn_confirm_sale_online`.
- [ ] **C4 / C5** Add `line_total = unit_price × qty` CHECK and the `subtotal = Σ line_total` deferred constraint trigger.
- [ ] **H3** Convert `slug`/`sku`/`barcode` `UNIQUE` to partial unique indexes (`WHERE deleted_at IS NULL`).
- [ ] **H2** Add the delivery‑snapshot NOT‑NULL CHECK.
- [ ] **H4 / H5 / H6** Tie payment/COD amounts to order total; cap refunds.
- [ ] **H8 / H9 / M10** Make trigger DDL (`create or replace trigger`), seed stock, policy DDL, and the deferred FK idempotent — so `supabase db reset` is safe.
- [ ] **H10** Add `idx_loyalty_ledger_user`.
- [ ] **H7** Set a non‑zero `reorder_point` default (or enforce per‑variant in onboarding).
- [ ] **M7 / M5** Add the COD `provider_intent_id` and promo `usage_limit` CHECKs.

### Soon after (before any scale / before exposing more surface)
- [ ] **M3** Resolve the `auth.users` duplicate‑trigger question.
- [ ] **M9** Add row‑existence guards to all 5 mutators, standardize return types, fix the line‑102 comment.
- [ ] **M8** Canonical variant lock ordering + `40P01` retry (or a single multi‑item reserve RPC).
- [ ] **M1** FK `ON DELETE SET NULL` + retarget `ck_order_delivery_target` to the snapshot.
- [ ] **M4** Widen/split `discount_value` to `bigint`.
- [ ] **M6** Validate ledger `balance_after`; make stock snapshots `NOT NULL`.
- [ ] **M11** Switch audit FKs to `ON DELETE RESTRICT`.
- [ ] **L1 / L2** `match_method` CHECK; confirm refund authority (owner‑only?).

### Later / when volume warrants
- [ ] **M12** `analytics_event` retention cron or partitioning + runbook SOP.
- [ ] **M13** Full `cart.user_id` index if history queries appear.
- [ ] **M2 (message)** Tighten v1.5 `message` policies before activating in‑app messaging.

---

## 7. What the council verified as correct (green ticks)

These were checked and are sound — no action needed:

- **Money discipline.** All money columns are `bigint` minor units; `currency` is uniformly `char(3) 'SLE'`. `ck_order_total` (`:349‑350`) correctly derives the total with `COALESCE(delivery_fee_minor,0)` for the NULL‑until‑confirmed fee.
- **Two‑dimension stock ledger.** `ck_ledger_nonzero` (`:180`) requires every movement to touch on‑hand or reserved. `stock_ledger.variant_id` is `ON DELETE RESTRICT` (`:167`), protecting history; soft delete via `product_variant.deleted_at` still works.
- **Hot‑path RPC locking.** `fn_reserve_stock` (`:108‑127`) and `fn_sell_instore` (`:164‑181`) correctly use `SELECT … FOR UPDATE`, guard availability, and return `boolean` for "out of stock".
- **Inventory privacy.** Customers never see raw counts — only `availability_signal.band` via Realtime; `inventory_item`/`stock_ledger` are staff‑only.
- **AuthZ architecture.** `current_app_role`/`is_staff`/`current_rider_id` are `SECURITY DEFINER` with pinned `search_path` and no recursion; the 8 inventory mutators are revoked from `anon`/`authenticated` and granted to `service_role` only (`:230‑249`). Customer rows scope to `auth.uid()`; riders see only assigned jobs; the public catalog exposes active rows only.
- **Circular FK.** `app_user.default_delivery_location_id → delivery_location` is added deferred with `ON DELETE SET NULL` (`:229‑232`); both sides nullable — cycle handled cleanly.
- **Partial unique indexes.** One default store, one default location/user, one active cart/user, one primary image/product, one active restock/user+variant — all correct.
- **Payments mechanics.** `UNIQUE(provider, provider_event_id)` and `UNIQUE(provider, idempotency_key)` are the idempotency anchors; `raw_body` is stored as `text` for HMAC verification; `idempotency_key` is `NOT NULL` for both rails. (The status‑guarded UPDATE is an application pattern — see the docs comment recommendation.)
- **tsvector generated column is valid (correcting an earlier note).** `search_tsv` uses the **two‑argument** `to_tsvector('simple'::regconfig, …)` form, which **is `IMMUTABLE`** (only the single‑arg form is `STABLE`). The stored generated column is correct and the "explicit immutable config" comment is accurate.
- **`idx_inventory_lowstock`** deliberately uses the raw `(qty_on_hand - qty_reserved)` expression instead of the generated column for cross‑version safety — a good call.
- **Schema hygiene.** Enums as `text + CHECK`; `"order"` reserved word quoted throughout; `loyalty_config` singleton (`id = 1`); `fn_review_rollup` recomputes `avg_rating`/`review_count` from published reviews on every change.
- **Migration ordering.** No forward references — `gen_order_number()` exists before use; the deferred FK follows `delivery_location`; no trigger recursion/loops.
- **Indexing baseline.** Keyset pagination indexes (`order`, `notification`, `conversation`) and search indexes (GIN `tsvector` + `pg_trgm`) are present and correctly configured. `pgcrypto`/`pg_trgm` enabled.

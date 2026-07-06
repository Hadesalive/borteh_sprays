-- =====================================================================
-- Profile engagement: real coupons, referrals, and the plumbing they need.
--
-- 1. Coupons become REAL. promo_code gains issued_to_user_id (personal
--    coupons), customers can read their own, fn_validate_promo() checks a
--    code server-side, and fn_place_order() gains p_promo_code so the
--    discount actually lands on the order (it was client-side display
--    only before — the server always charged full subtotal).
-- 2. Referrals. Every user can mint a share code; a friend applies it
--    before their first order; the friend's FIRST DELIVERED order pays
--    the referrer points through the existing loyalty ledger + a
--    notification. Tunable via loyalty_config.referral_points (0 = off).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Store phone — powers the app's "WhatsApp us" row (store_location is
--    already customer-readable; the owner sets the number in Settings →
--    Store profile). Free wa.me deep link, no comms API.
-- ---------------------------------------------------------------------

alter table public.store_location add column if not exists phone text;

-- ---------------------------------------------------------------------
-- 1a. Personal coupons
-- ---------------------------------------------------------------------

alter table public.promo_code add column if not exists issued_to_user_id uuid references public.app_user(id) on delete set null;
create index if not exists idx_promo_issued_to on public.promo_code (issued_to_user_id) where issued_to_user_id is not null;

-- Customers see their own coupons (public codes stay validation-only, via RPC)
create policy promo_read_own on public.promo_code
  for select to authenticated using (issued_to_user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 1b. Server-side validation — one source of truth for checkout preview
--     and order placement.
-- ---------------------------------------------------------------------

create or replace function public.fn_validate_promo(p_code text, p_subtotal_minor bigint)
returns table(promo_id uuid, discount_minor bigint, label text)
language plpgsql
security definer
set search_path = public
as $$
declare
  r      public.promo_code%rowtype;
  v_uid  uuid := auth.uid();
  v_disc bigint;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into r from public.promo_code
   where upper(code) = upper(btrim(p_code)) and is_active;
  if not found then raise exception 'invalid_code'; end if;
  if r.issued_to_user_id is not null and r.issued_to_user_id <> v_uid then
    raise exception 'invalid_code';
  end if;
  if (r.starts_at is not null and r.starts_at > now())
     or (r.ends_at is not null and r.ends_at < now()) then
    raise exception 'expired';
  end if;
  if r.usage_limit is not null and r.usage_count >= r.usage_limit then
    raise exception 'used_up';
  end if;
  if (select count(*) from public."order" o
       where o.promo_code_id = r.id and o.user_id = v_uid and o.status <> 'cancelled') >= r.per_user_limit then
    raise exception 'already_used';
  end if;
  if p_subtotal_minor < r.min_order_minor then
    raise exception 'min_order:%', r.min_order_minor;
  end if;

  v_disc := case r.discount_type
    when 'percent' then (p_subtotal_minor * r.discount_value) / 100
    else r.discount_value::bigint
  end;
  if r.max_discount_minor is not null then v_disc := least(v_disc, r.max_discount_minor); end if;
  v_disc := least(v_disc, p_subtotal_minor);

  promo_id := r.id;
  discount_minor := v_disc;
  label := case r.discount_type when 'percent' then r.discount_value || '% off' else 'discount' end;
  return next;
end;
$$;

grant execute on function public.fn_validate_promo(text, bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 1c. fn_place_order v3 — promo-aware. Dropped (not replaced): the added
--     defaulted param would otherwise create an ambiguous overload.
-- ---------------------------------------------------------------------

drop function if exists public.fn_place_order(jsonb, text, text, text, uuid, text);

create or replace function public.fn_place_order(
  p_items          jsonb,
  p_landmark       text,
  p_contact_phone  text,
  p_recipient_name text,
  p_zone_id        uuid default null,
  p_notes          text default null,
  p_promo_code     text default null
) returns table(order_id uuid, order_number text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid      uuid := auth.uid();
  v_store    uuid;
  v_loc      uuid;
  v_order    uuid;
  v_number   text;
  v_subtotal bigint := 0;
  v_promo    uuid;
  v_discount bigint := 0;
  it         jsonb;
  v_variant  uuid;
  v_qty      int;
  v_price    bigint;
  v_pname    text;
  v_label    text;
  v_sku      text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'your bag is empty'; end if;
  if coalesce(btrim(p_landmark), '') = '' then raise exception 'a delivery landmark is required'; end if;
  if coalesce(btrim(p_contact_phone), '') = '' then raise exception 'a contact phone is required'; end if;

  select id into v_store from public.store_location where is_active order by is_default desc, created_at asc limit 1;
  if v_store is null then raise exception 'no store is configured'; end if;

  insert into public.delivery_location (user_id, zone_id, landmark_text, contact_phone, recipient_name)
  values (v_uid, p_zone_id, btrim(p_landmark), btrim(p_contact_phone), nullif(btrim(p_recipient_name), ''))
  returning id into v_loc;

  -- Server-authoritative subtotal from live variant prices.
  for it in select * from jsonb_array_elements(p_items) loop
    v_variant := (it->>'variant_id')::uuid;
    v_qty     := (it->>'qty')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'invalid quantity'; end if;
    select pv.price_minor into v_price
      from public.product_variant pv
     where pv.id = v_variant and pv.is_active and pv.deleted_at is null;
    if v_price is null then raise exception 'a fragrance in your bag is no longer available'; end if;
    v_subtotal := v_subtotal + v_price * v_qty;
  end loop;

  -- Server-authoritative discount — same rules the checkout preview used.
  if coalesce(btrim(p_promo_code), '') <> '' then
    select vp.promo_id, vp.discount_minor into v_promo, v_discount
      from public.fn_validate_promo(p_promo_code, v_subtotal) vp;
    update public.promo_code set usage_count = usage_count + 1 where id = v_promo;
  end if;

  insert into public."order" (
    user_id, status, fulfillment_type, payment_method, store_location_id, delivery_location_id, delivery_zone_id,
    landmark_snapshot, contact_phone_snapshot, recipient_name_snapshot,
    subtotal_minor, discount_minor, total_minor, promo_code_id, notes, placed_at
  ) values (
    v_uid, 'confirmed', 'delivery', 'cash_on_delivery', v_store, v_loc, p_zone_id,
    btrim(p_landmark), btrim(p_contact_phone), nullif(btrim(p_recipient_name), ''),
    v_subtotal, v_discount, v_subtotal - v_discount, v_promo, nullif(btrim(p_notes), ''), now()
  ) returning id, order_number into v_order, v_number;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (v_order, null, 'confirmed', v_uid, 'Placed — cash on delivery');

  for it in select * from jsonb_array_elements(p_items) loop
    v_variant := (it->>'variant_id')::uuid;
    v_qty     := (it->>'qty')::int;
    select pv.price_minor, pv.sku, (pv.size_ml || ' ml · ' || pv.concentration), p.name
      into v_price, v_sku, v_label, v_pname
      from public.product_variant pv join public.product p on p.id = pv.product_id
     where pv.id = v_variant;

    insert into public.order_item (
      order_id, variant_id, product_name_snapshot, variant_label_snapshot, sku_snapshot,
      unit_price_minor, qty, line_total_minor
    ) values (v_order, v_variant, v_pname, v_label, v_sku, v_price, v_qty, v_price * v_qty);

    if not public.fn_reserve_stock(v_variant, v_qty, v_order, v_uid) then
      raise exception '% is out of stock', v_pname;
    end if;
  end loop;

  order_id := v_order;
  order_number := v_number;
  return next;
end;
$$;

grant execute on function public.fn_place_order(jsonb, text, text, text, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Referrals
-- ---------------------------------------------------------------------

alter table public.app_user add column if not exists referral_code text unique;
alter table public.app_user add column if not exists referred_by uuid references public.app_user(id) on delete set null;
alter table public.loyalty_config add column if not exists referral_points int not null default 100;

-- Mint (lazily) and return the caller's share code.
create or replace function public.fn_my_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select referral_code into v_code from public.app_user where id = v_uid;
  if v_code is not null then return v_code; end if;
  loop
    v_code := 'BOR-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    begin
      update public.app_user set referral_code = v_code where id = v_uid;
      exit;
    exception when unique_violation then
      -- rare collision — mint again
    end;
  end loop;
  return v_code;
end;
$$;

-- Apply a friend's code — once, before your first order. Returns their first name.
create or replace function public.fn_apply_referral(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_ref  uuid;
  v_name text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id, split_part(coalesce(display_name, 'A friend'), ' ', 1)
    into v_ref, v_name
    from public.app_user
   where referral_code = upper(btrim(p_code)) and not is_blocked;
  if v_ref is null then raise exception 'invalid_code'; end if;
  if v_ref = v_uid then raise exception 'own_code'; end if;
  if (select referred_by from public.app_user where id = v_uid) is not null then
    raise exception 'already_referred';
  end if;
  if exists (select 1 from public."order" where user_id = v_uid) then
    raise exception 'too_late'; -- referrals are for new customers
  end if;
  update public.app_user set referred_by = v_ref where id = v_uid;
  return v_name;
end;
$$;

grant execute on function public.fn_my_referral_code() to authenticated;
grant execute on function public.fn_apply_referral(text) to authenticated;

-- The friend's first DELIVERED order pays the referrer — once per referred
-- user (the ledger reason doubles as the idempotency key), through the same
-- ledger the rest of loyalty uses, plus a notification on the same rails.
create or replace function public.fn_reward_referral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref     uuid;
  v_pts     int;
  v_enabled boolean;
  v_acct    uuid;
  v_bal     int;
  v_first   text;
begin
  if new.status <> 'delivered' or old.status = 'delivered' then return new; end if;

  select referred_by into v_ref from public.app_user where id = new.user_id;
  if v_ref is null then return new; end if;

  select loyalty_enabled, referral_points into v_enabled, v_pts from public.loyalty_config where id = 1;
  if not coalesce(v_enabled, false) or coalesce(v_pts, 0) <= 0 then return new; end if;

  if exists (select 1 from public.loyalty_ledger
              where user_id = v_ref and reason = 'referral:' || new.user_id) then
    return new; -- already paid for this friend
  end if;

  insert into public.loyalty_account (user_id, points_balance, lifetime_points)
  values (v_ref, v_pts, v_pts)
  on conflict (user_id) do update
    set points_balance  = public.loyalty_account.points_balance + excluded.points_balance,
        lifetime_points = public.loyalty_account.lifetime_points + excluded.lifetime_points
  returning id, points_balance into v_acct, v_bal;

  insert into public.loyalty_ledger (account_id, user_id, delta, type, order_id, balance_after, reason)
  values (v_acct, v_ref, v_pts, 'earn', new.id, v_bal, 'referral:' || new.user_id);

  select split_part(coalesce(display_name, 'Your friend'), ' ', 1) into v_first
    from public.app_user where id = new.user_id;

  insert into public.notification (user_id, type, channel, title, body, status)
  values (v_ref, 'system', 'in_app',
          '+' || v_pts || ' points — thank you',
          v_first || '''s first order arrived. Your referral points are in.',
          'delivered');

  return new;
end;
$$;

drop trigger if exists trg_reward_referral on public."order";
create trigger trg_reward_referral
  after update of status on public."order"
  for each row execute function public.fn_reward_referral();

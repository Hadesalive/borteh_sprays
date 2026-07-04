-- 20260616090002_schema.sql
-- Borteh Sprays 001 — full relational schema (single store, online-first).
-- Faithful to docs/06-data-model.md. Tables created in FK-dependency order.
-- Notes on two deliberate deviations from the design sketch (both flagged in 06 §16):
--   * product.search_tsv uses an explicit immutable config ('simple'::regconfig).
--   * idx_inventory_lowstock uses the raw expression (qty_on_hand - qty_reserved)
--     instead of the generated column, to stay valid across Postgres versions.

-- =====================================================================
-- 1. CATALOG
-- =====================================================================
create table public.brand (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  description text,
  logo_path   text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
-- soft-delete-safe uniqueness (audit H3): a deleted slug can be reused
create unique index uq_brand_slug on public.brand (slug) where deleted_at is null;

create table public.category (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.category(id) on delete set null,
  name        text not null,
  slug        text not null,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index idx_category_parent on public.category (parent_id);
create unique index uq_category_slug on public.category (slug) where deleted_at is null;

create table public.product (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references public.brand(id) on delete restrict,
  category_id  uuid references public.category(id) on delete set null,
  name         text not null,
  slug         text not null,
  description  text,
  gender       text not null default 'unisex' check (gender in ('male','female','unisex')),
  avg_rating   numeric(2,1) not null default 0,
  review_count int not null default 0,
  is_active    boolean not null default true,
  is_featured  boolean not null default false,
  popularity_score int not null default 0,
  search_tsv   tsvector generated always as
                 (to_tsvector('simple'::regconfig,
                    coalesce(name,'') || ' ' || coalesce(description,''))) stored,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index idx_product_brand     on public.product (brand_id);
create index idx_product_category  on public.product (category_id);
create index idx_product_gender    on public.product (gender);
create index idx_product_search    on public.product using gin (search_tsv);
create index idx_product_name_trgm on public.product using gin (name gin_trgm_ops);
create index idx_product_popularity on public.product (popularity_score desc, id desc) where is_active;
create unique index uq_product_slug on public.product (slug) where deleted_at is null;

create table public.product_variant (
  id                     uuid primary key default gen_random_uuid(),
  product_id             uuid not null references public.product(id) on delete cascade,
  size_ml                int not null check (size_ml > 0),
  concentration          text not null check (concentration in ('EDC','EDT','EDP','Parfum','Extrait')),
  sku                    text not null,
  barcode                text,
  price_minor            bigint not null check (price_minor >= 0),
  compare_at_price_minor bigint check (compare_at_price_minor >= 0),
  currency               char(3) not null default 'SLE',
  weight_grams           int,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);
create index idx_variant_product on public.product_variant (product_id);
create index idx_variant_barcode on public.product_variant (barcode);
create unique index uq_variant_sku     on public.product_variant (sku)     where deleted_at is null;
create unique index uq_variant_barcode on public.product_variant (barcode) where deleted_at is null and barcode is not null;

create table public.product_image (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.product(id) on delete cascade,
  variant_id   uuid references public.product_variant(id) on delete cascade,
  storage_path text not null,
  alt_text     text,
  width        int,
  height       int,
  sort_order   int not null default 0,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_image_product on public.product_image (product_id, sort_order);
create unique index uq_image_primary on public.product_image (product_id) where is_primary;

create table public.scent_note (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  note_family text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.product_scent_note (
  product_id    uuid not null references public.product(id) on delete cascade,
  scent_note_id uuid not null references public.scent_note(id) on delete cascade,
  position      text not null check (position in ('top','heart','base')),
  primary key (product_id, scent_note_id, position)
);
create index idx_psn_note on public.product_scent_note (scent_note_id);

-- =====================================================================
-- 2. STORE + USERS  (app_user references auth.users; default-loc FK deferred)
-- =====================================================================
create table public.store_location (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  code         text not null unique,
  type         text not null default 'retail_store' check (type in ('retail_store','warehouse')),
  address_text text,
  geo_lat      double precision,
  geo_lng      double precision,
  is_default   boolean not null default false,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index uq_store_default on public.store_location (is_default) where is_default;

create table public.app_user (
  id            uuid primary key references auth.users(id) on delete cascade,
  phone         text not null unique,           -- E.164; UNIQUE login id (ADR-004)
  email         text unique,                    -- optional, recovery only
  display_name  text,
  role          text not null default 'customer' check (role in ('customer','staff','owner','rider')),
  default_delivery_location_id uuid,            -- FK added after delivery_location
  avatar_path   text,
  is_blocked    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_user_role on public.app_user (role);

-- =====================================================================
-- 3. INVENTORY  (single store; per-variant balance + two-dimension ledger)
-- =====================================================================
create table public.inventory_item (
  id            uuid primary key default gen_random_uuid(),
  variant_id    uuid not null unique references public.product_variant(id) on delete cascade,
  qty_on_hand   int not null default 0 check (qty_on_hand >= 0),
  qty_reserved  int not null default 0 check (qty_reserved >= 0),
  qty_available int generated always as (qty_on_hand - qty_reserved) stored,
  reorder_point int not null default 5,   -- non-zero so the 'low' band + low-stock cron actually trigger (audit H7)
  reorder_qty   int not null default 0,
  updated_at    timestamptz not null default now(),
  constraint ck_reserved_le_onhand check (qty_reserved <= qty_on_hand)
);
-- Low-stock feed for the cron (ADR-011): raw expression keeps the predicate version-safe.
create index idx_inventory_lowstock on public.inventory_item (variant_id)
  where (qty_on_hand - qty_reserved) <= reorder_point;

create table public.stock_ledger (
  id                 uuid primary key default gen_random_uuid(),
  variant_id         uuid not null references public.product_variant(id) on delete restrict,
  movement_type      text not null check (movement_type in
                       ('purchase','sale_online','sale_instore','adjustment',
                        'transfer_in','transfer_out','reservation','release','return')),
  qty_delta          int not null default 0,
  qty_reserved_delta int not null default 0,
  balance_after      int,
  reserved_after     int,
  reference_type     text,
  reference_id       uuid,
  reason             text,
  created_by         uuid references public.app_user(id),
  created_at         timestamptz not null default now(),
  constraint ck_ledger_nonzero check (qty_delta <> 0 or qty_reserved_delta <> 0)
);
create index idx_ledger_variant   on public.stock_ledger (variant_id, created_at);
create index idx_ledger_reference on public.stock_ledger (reference_type, reference_id);
create index idx_ledger_type      on public.stock_ledger (movement_type, created_at);

create table public.availability_signal (
  variant_id uuid primary key references public.product_variant(id) on delete cascade,
  band       text not null default 'out' check (band in ('in_stock','low','out')),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 4. DELIVERY ZONES, LOCATIONS, RIDERS
-- =====================================================================
create table public.delivery_zone (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  region_text text,
  estimated_fee_minor bigint check (estimated_fee_minor >= 0),  -- GUIDE only (ADR-013)
  fee_estimate_text   text,
  currency    char(3) not null default 'SLE',
  eta_text    text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.delivery_location (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.app_user(id) on delete cascade,
  zone_id        uuid references public.delivery_zone(id) on delete set null,
  label          text,
  landmark_text  text not null,                 -- REQUIRED: weak street addressing
  geo_lat        double precision,
  geo_lng        double precision,
  contact_phone  text not null,
  recipient_name text,
  notes          text,
  is_default     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index idx_delivery_location_user on public.delivery_location (user_id);
create unique index uq_deliveryloc_default on public.delivery_location (user_id) where is_default;

-- close the circular FK app_user -> delivery_location
alter table public.app_user
  add constraint fk_user_default_loc
  foreign key (default_delivery_location_id)
  references public.delivery_location(id) on delete set null;

create table public.rider (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.app_user(id) on delete cascade,
  vehicle_type    text not null default 'motorbike' check (vehicle_type in ('motorbike','car','bicycle','foot')),
  vehicle_plate   text,
  status          text not null default 'offline' check (status in ('available','busy','offline')),
  current_zone_id uuid references public.delivery_zone(id) on delete set null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_rider_status on public.rider (status, current_zone_id);

-- =====================================================================
-- 5. WISHLIST + CART
-- =====================================================================
create table public.wishlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.app_user(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wishlist_item (
  id          uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlist(id) on delete cascade,
  product_id  uuid not null references public.product(id) on delete cascade,
  variant_id  uuid references public.product_variant(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint uq_wishlist_item unique (wishlist_id, product_id, variant_id)
);
create index idx_wishlist_item_wl on public.wishlist_item (wishlist_id);

create table public.cart (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.app_user(id) on delete cascade,
  status     text not null default 'active' check (status in ('active','converted','abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_cart_active on public.cart (user_id) where status = 'active';

create table public.cart_item (
  id               uuid primary key default gen_random_uuid(),
  cart_id          uuid not null references public.cart(id) on delete cascade,
  variant_id       uuid not null references public.product_variant(id) on delete cascade,
  qty              int not null check (qty > 0),
  unit_price_minor bigint not null,
  added_at         timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint uq_cart_item unique (cart_id, variant_id)
);
create index idx_cart_item_cart on public.cart_item (cart_id);

-- =====================================================================
-- 6. PROMO CODES  (typed coupons; automatic promos live in promo_rule)
-- =====================================================================
create table public.promo_code (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  description        text,
  discount_type      text not null check (discount_type in ('percent','fixed')),
  discount_value     int not null check (discount_value > 0),
  max_discount_minor bigint,
  min_order_minor    bigint not null default 0,
  usage_limit        int,
  usage_count        int not null default 0,
  per_user_limit     int not null default 1,
  starts_at          timestamptz,
  ends_at            timestamptz,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_promo_active on public.promo_code (is_active, ends_at);

-- =====================================================================
-- 7. ORDERS
-- =====================================================================
create table public."order" (
  id                  uuid primary key default gen_random_uuid(),
  order_number        text not null unique default public.gen_order_number(),
  user_id             uuid not null references public.app_user(id) on delete restrict,
  status              text not null default 'pending_payment' check (status in
                        ('pending_payment','confirmed','preparing','out_for_delivery',
                         'delivered','cancelled','returned')),
  fulfillment_type    text not null default 'delivery' check (fulfillment_type in ('delivery','pickup')),
  payment_method      text not null check (payment_method in ('monime','cash_on_delivery')),
  store_location_id   uuid not null references public.store_location(id),
  delivery_location_id uuid references public.delivery_location(id),
  delivery_zone_id    uuid references public.delivery_zone(id),
  promo_code_id       uuid references public.promo_code(id),
  landmark_snapshot       text,
  geo_lat_snapshot        double precision,
  geo_lng_snapshot        double precision,
  contact_phone_snapshot  text,
  recipient_name_snapshot text,
  subtotal_minor      bigint not null check (subtotal_minor >= 0),
  delivery_fee_minor  bigint check (delivery_fee_minor >= 0),         -- NULL until owner-confirmed (ADR-013)
  delivery_fee_confirmed_at timestamptz,
  discount_minor      bigint not null default 0 check (discount_minor >= 0),
  loyalty_redeem_minor bigint not null default 0 check (loyalty_redeem_minor >= 0),
  total_minor         bigint not null check (total_minor >= 0),
  currency            char(3) not null default 'SLE',
  loyalty_points_earned   int not null default 0,
  loyalty_points_redeemed int not null default 0,
  notes               text,
  cancel_reason       text,
  placed_at           timestamptz,
  confirmed_at        timestamptz,
  delivered_at        timestamptz,
  cancelled_at        timestamptz,
  returned_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint ck_order_total check (
    total_minor = subtotal_minor + coalesce(delivery_fee_minor,0) - discount_minor - loyalty_redeem_minor),
  constraint ck_order_delivery_target check (
    fulfillment_type = 'pickup' or delivery_location_id is not null),
  -- a delivery order must capture the drop-off snapshot so the rider has it even if the
  -- source delivery_location later changes/deletes (audit H2)
  constraint ck_order_delivery_snapshot check (
    fulfillment_type = 'pickup'
    or (landmark_snapshot is not null and contact_phone_snapshot is not null))
);
create index idx_order_user   on public."order" (user_id, created_at desc);
create index idx_order_status on public."order" (status, created_at);
create index idx_order_store  on public."order" (store_location_id, status);

create table public.order_item (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null references public."order"(id) on delete cascade,
  variant_id             uuid references public.product_variant(id) on delete set null,
  product_name_snapshot  text not null,
  variant_label_snapshot text not null,
  sku_snapshot           text not null,
  unit_price_minor       bigint not null check (unit_price_minor >= 0),
  qty                    int not null check (qty > 0),
  line_total_minor       bigint not null check (line_total_minor >= 0),
  created_at             timestamptz not null default now(),
  constraint ck_order_item_line_total check (line_total_minor = unit_price_minor * qty)  -- audit C4
);
create index idx_order_item_order on public.order_item (order_id);

create table public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public."order"(id) on delete cascade,
  from_status text,
  to_status   text not null,
  changed_by  uuid references public.app_user(id),
  note        text,
  created_at  timestamptz not null default now()
);
create index idx_osh_order on public.order_status_history (order_id, created_at);

-- =====================================================================
-- 8. PAYMENTS  (Monime PaymentIntent + PaymentWebhook + manual Refund)
-- =====================================================================
create table public.payment_intent (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public."order"(id) on delete restrict,
  provider            text not null check (provider in ('monime','cash_on_delivery')),
  provider_intent_id  text,                          -- Monime result.id = 'scs-...'
  status              text not null default 'created' check (status in
                        ('created','processing','succeeded','failed','cancelled','expired')),
  amount_minor        bigint not null check (amount_minor >= 0),
  currency            char(3) not null default 'SLE',
  idempotency_key     text not null,
  callback_state      text,
  metadata            jsonb not null default '{}'::jsonb,
  redirect_url        text,
  checkout_session_raw jsonb,
  reservation_expires_at timestamptz,
  paid_at             timestamptz,
  failure_reason      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint uq_intent_provider_id unique (provider, provider_intent_id),
  constraint uq_intent_idem unique (provider, idempotency_key)
);
create index idx_intent_order  on public.payment_intent (order_id);
create index idx_intent_status on public.payment_intent (status, reservation_expires_at);

create table public.payment_webhook (
  id                uuid primary key default gen_random_uuid(),
  payment_intent_id uuid references public.payment_intent(id) on delete set null,
  provider          text not null default 'monime',
  provider_event_id text not null,                   -- event.id; idempotency anchor
  event_type        text not null,
  signature_t       bigint,
  raw_body          text not null,                   -- RAW bytes (read before JSON parse)
  payload           jsonb,
  verified          boolean not null default false,
  processed         boolean not null default false,
  match_method      text,
  error             text,
  received_at       timestamptz not null default now(),
  processed_at      timestamptz,
  created_at        timestamptz not null default now(),
  constraint uq_webhook_event unique (provider, provider_event_id)
);
create index idx_webhook_intent on public.payment_webhook (payment_intent_id);
create index idx_webhook_unproc on public.payment_webhook (processed, event_type) where not processed;

create table public.refund (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public."order"(id) on delete restrict,
  payment_intent_id    uuid references public.payment_intent(id) on delete set null,
  amount_minor         bigint not null check (amount_minor > 0),
  currency             char(3) not null default 'SLE',
  status               text not null default 'pending' check (status in
                         ('pending','manual_processing','completed','failed')),
  reason               text,
  monime_dashboard_ref text,
  requested_by         uuid references public.app_user(id),
  processed_by         uuid references public.app_user(id),
  requested_at         timestamptz not null default now(),
  completed_at         timestamptz,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index idx_refund_order  on public.refund (order_id);
create index idx_refund_status on public.refund (status, requested_at);

-- =====================================================================
-- 9. DELIVERY JOBS
-- =====================================================================
create table public.delivery_job (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null unique references public."order"(id) on delete cascade,
  rider_id            uuid references public.rider(id) on delete set null,
  status              text not null default 'assigned' check (status in
                        ('assigned','picked_up','delivered','failed_attempt','returned')),
  assigned_by         uuid references public.app_user(id),
  cod_expected_minor  bigint not null default 0 check (cod_expected_minor >= 0),
  cod_collected_minor bigint not null default 0 check (cod_collected_minor >= 0),
  cod_remitted        boolean not null default false,
  proof_photo_path    text,
  recipient_note      text,
  failure_reason      text,
  sequence_no         int,
  assigned_at         timestamptz,
  picked_up_at        timestamptz,
  delivered_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_deljob_rider  on public.delivery_job (rider_id, status);
create index idx_deljob_status on public.delivery_job (status, created_at);

-- =====================================================================
-- 10. ENGAGEMENT: restock, reviews, notifications
-- =====================================================================
create table public.restock_subscription (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_user(id) on delete cascade,
  variant_id  uuid not null references public.product_variant(id) on delete cascade,
  status      text not null default 'active' check (status in ('active','notified','cancelled')),
  channel     text not null default 'in_app' check (channel in ('in_app','push','any')),
  notified_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index uq_restock_active on public.restock_subscription (user_id, variant_id) where status = 'active';
create index idx_restock_variant on public.restock_subscription (variant_id) where status = 'active';

create table public.review (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.product(id) on delete cascade,
  user_id           uuid not null references public.app_user(id) on delete cascade,
  order_id          uuid references public."order"(id) on delete set null,
  rating            int not null check (rating between 1 and 5),
  title             text,
  body              text,
  verified_purchase boolean not null default false,
  status            text not null default 'pending' check (status in ('pending','published','rejected')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_review_user_product unique (user_id, product_id)
);
create index idx_review_product on public.review (product_id, status);

create table public.notification (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.app_user(id) on delete cascade,
  type          text not null check (type in ('order_status','restock_available','delivery','promo','system')),
  channel       text not null default 'in_app' check (channel in ('in_app','push')),
  title         text,
  body          text not null,
  status        text not null default 'queued' check (status in ('queued','sent','delivered','failed')),
  provider_ref  text,
  reference_type text,
  reference_id  uuid,
  error         text,
  read_at       timestamptz,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index idx_notif_user  on public.notification (user_id, created_at desc);
create index idx_notif_queue on public.notification (status, created_at) where status = 'queued';

create table public.notification_preference (
  user_id          uuid primary key references public.app_user(id) on delete cascade,
  in_app_enabled   boolean not null default true,
  push_enabled     boolean not null default false,
  push_token       text,
  marketing_opt_in boolean not null default false,
  updated_at       timestamptz not null default now()
);

-- =====================================================================
-- 11. CONFIGURABLE LOYALTY & PROMOTIONS (ADR-012)
-- =====================================================================
create table public.loyalty_config (
  id                       int primary key default 1 check (id = 1),
  loyalty_enabled          boolean not null default true,
  promos_enabled           boolean not null default true,
  tiers_enabled            boolean not null default true,
  points_per_currency_unit numeric(10,4) not null default 0,
  point_value_minor        bigint not null default 0 check (point_value_minor >= 0),
  points_expiry_days       int,
  updated_at               timestamptz not null default now()
);

create table public.promo_rule (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  rule_type         text not null check (rule_type in
                      ('order_spend_threshold_discount','points_earn','loyalty_card_grant')),
  threshold_minor   bigint not null default 0 check (threshold_minor >= 0),
  discount_type     text check (discount_type in ('percent','fixed')),
  discount_value    int check (discount_value >= 0),
  points_multiplier numeric(10,4),
  scope             text not null default 'all' check (scope in ('all','category','brand','product')),
  scope_id          uuid,
  active_from       timestamptz,
  active_to         timestamptz,
  usage_limit       int,
  usage_count       int not null default 0,
  per_user_limit    int,
  priority          int not null default 0,
  stackable         boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_promo_rule_active on public.promo_rule (is_active, active_to);

create table public.loyalty_tier (
  id                               uuid primary key default gen_random_uuid(),
  name                             text not null unique,
  cumulative_spend_threshold_minor bigint not null default 0 check (cumulative_spend_threshold_minor >= 0),
  discount_percent                 numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  rank                             int not null default 0,
  is_active                        boolean not null default true,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table public.loyalty_account (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references public.app_user(id) on delete cascade,
  points_balance       int not null default 0 check (points_balance >= 0),
  lifetime_points      int not null default 0,
  lifetime_spend_minor bigint not null default 0 check (lifetime_spend_minor >= 0),
  current_tier_id      uuid references public.loyalty_tier(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.loyalty_ledger (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.loyalty_account(id) on delete cascade,
  user_id       uuid not null references public.app_user(id) on delete cascade,
  delta         int not null,
  type          text not null check (type in ('earn','redeem','expire','adjustment')),
  order_id      uuid references public."order"(id) on delete set null,
  balance_after int not null,
  reason        text,
  created_at    timestamptz not null default now()
);
create index idx_loyalty_ledger_acct on public.loyalty_ledger (account_id, created_at);
create index idx_loyalty_ledger_user on public.loyalty_ledger (user_id, created_at);  -- RLS reads by user_id (audit H10)

-- =====================================================================
-- 12. ANALYTICS
-- =====================================================================
create table public.analytics_event (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.app_user(id) on delete set null,
  session_id  text,
  event_type  text not null,
  entity_type text,
  entity_id   uuid,
  properties  jsonb not null default '{}'::jsonb,
  app_version text,
  device_info jsonb,
  occurred_at timestamptz not null,
  created_at  timestamptz not null default now()
);
create index idx_ae_type_time on public.analytics_event (event_type, occurred_at);
create index idx_ae_user      on public.analytics_event (user_id, occurred_at);

-- =====================================================================
-- 13. OPTIONAL IN-APP MESSAGING (v1.5 — tables present, unused until built)
-- =====================================================================
create table public.conversation (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.app_user(id) on delete cascade,
  order_id        uuid references public."order"(id) on delete set null,
  subject         text,
  status          text not null default 'open' check (status in ('open','closed')),
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_conversation_user on public.conversation (user_id, last_message_at desc);

create table public.message (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversation(id) on delete cascade,
  sender_id       uuid references public.app_user(id) on delete set null,
  sender_role     text not null check (sender_role in ('customer','staff','owner')),
  body            text not null,
  attachment_path text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index idx_message_conversation on public.message (conversation_id, created_at);

-- =====================================================================
-- Give the USSD payment code an explicit expiry, and anchor the stock
-- reservation to it.
--
-- Two bugs, one root cause — nothing recorded WHEN the Monime payment code
-- goes stale:
--
-- 1. Dead retry path. payment-init treated "this intent already has a
--    provider_intent_id + ussd_code" as "we're done, never call Monime
--    again". True for checkout-sessions, false for Payment Codes: a code is
--    only dialable for its `duration` (15m), and re-POSTing with the same
--    Idempotency-Key hands back the SAME dead code. The order screen's "Get
--    a new code" button was therefore permanently broken from the moment the
--    first code expired.
--
-- 2. Two clocks, different start lines. reservation_expires_at was set to
--    now() + 15 min at ORDER PLACEMENT (fn_place_order), while the Monime
--    code's own 15 minutes only started later, when payment-init actually
--    ran — a separate network call with arbitrary UI time in between. So our
--    hold could expire while the customer's code was still perfectly
--    dialable. That is the 2026-08-29 incident's mechanism.
--
-- ussd_code_expires_at records Monime's own expireTime for the code that is
-- currently on the intent. payment-init writes it alongside the code, and
-- pushes reservation_expires_at out past it (see RESERVATION_GRACE_MS there)
-- so the sweep can never cancel an order whose code is still live.
--
-- NULL means "no live code" — every row that predates this migration is
-- correctly treated as needing a fresh one.
-- =====================================================================
alter table public.payment_intent add column if not exists ussd_code_expires_at timestamptz;

comment on column public.payment_intent.ussd_code_expires_at is
  'Monime expireTime of the payment code currently in ussd_code. NULL = no live code; payment-init issues a fresh one with a new Idempotency-Key.';

-- =====================================================================
-- Switch Monime online payment from a hosted checkout-session (browser
-- redirect) to a Payment Code (POST /v1/payment-codes): the customer dials
-- a USSD string shown in-app instead of leaving to a browser sheet — the
-- familiar mobile-money pattern in this market. redirect_url stays unused
-- for now (kept in case a redirect-based rail is ever added back); the
-- USSD string gets its own properly-named column rather than overloading
-- redirect_url with a meaning it doesn't have.
-- =====================================================================
alter table public.payment_intent add column ussd_code text;

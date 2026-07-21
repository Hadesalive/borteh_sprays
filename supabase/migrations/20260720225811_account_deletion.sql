-- 20260720225811_account_deletion.sql
-- In-app account deletion (Apple App Store Guideline 5.1.1(v): any app that creates accounts
-- must let the user delete theirs from inside the app). Exposes fn_delete_account(), called by
-- the mobile "Delete account" flow after an explicit confirmation.
--
-- Two outcomes, both leaving the person unable to log in and their personal data removed:
--   * NO order history  → hard delete: remove the auth.users row; every app_user-owned row
--     cascades away. The account is fully gone.
--   * HAS order history → anonymize + retain transactions: orders reference app_user with
--     ON DELETE RESTRICT (financial/accounting records are kept), so the auth row cannot be
--     dropped. Instead we purge all personal + behavioural data, scrub the app_user shell, and
--     neutralise the auth identity (null email/phone, ban) so login is impossible. The orders
--     survive detached from any identifiable person.
--
-- Login is phone+password mapped to a synthetic email (see mobile/lib/auth.ts) with no
-- is_blocked gate, so killing login means nulling the auth.users email/phone and banning the
-- row — app_user.is_blocked alone would not stop sign-in.
--
-- SECURITY DEFINER + owned by the migration role so it may touch auth.users; it only ever acts
-- on auth.uid(), never an arbitrary id.

create or replace function public.fn_delete_account()
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_has_orders boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- ---- purge personal + behavioural data -------------------------------------------------
  -- Parents cascade to their children (wishlist→wishlist_item, cart→cart_item,
  -- loyalty_account→loyalty_ledger). For a no-orders user these also cascade from the auth
  -- delete below; doing them explicitly makes the anonymize path complete too.
  delete from public.delivery_location     where user_id = v_uid;
  delete from public.wishlist              where user_id = v_uid;
  delete from public.cart                  where user_id = v_uid;
  delete from public.restock_subscription  where user_id = v_uid;
  delete from public.review                where user_id = v_uid;
  delete from public.notification          where user_id = v_uid;
  delete from public.notification_preference where user_id = v_uid;
  delete from public.loyalty_account       where user_id = v_uid;

  -- recs schema (append-only log + derived profile)
  delete from recs.events        where user_id = v_uid;
  delete from recs.user_profile  where user_id = v_uid;
  delete from recs.user_scent_prefs where user_id = v_uid;

  select exists (select 1 from public."order" where user_id = v_uid) into v_has_orders;

  if not v_has_orders then
    -- Clean hard delete: cascades app_user and anything else keyed on the auth id.
    delete from auth.users where id = v_uid;
    return 'deleted';
  end if;

  -- Retain anonymized transactions. Scrub the app_user shell first.
  update public.app_user
     set display_name = 'Deleted account',
         email        = null,
         phone        = 'deleted:' || v_uid::text,   -- keep the UNIQUE(phone) index satisfied
         avatar_path  = null,
         referred_by  = null,
         is_blocked   = true,
         updated_at   = now()
   where id = v_uid;

  -- Neutralise the login. Nulling email (the synthetic login key) + phone makes the account
  -- unreachable by signInWithPassword; banned_until is belt-and-braces.
  update auth.users
     set email              = null,
         phone              = null,
         email_confirmed_at = null,
         phone_confirmed_at = null,
         banned_until       = 'infinity'::timestamptz,
         updated_at         = now()
   where id = v_uid;

  return 'anonymized';
end;
$$;

revoke all on function public.fn_delete_account() from public, anon;
grant execute on function public.fn_delete_account() to authenticated;

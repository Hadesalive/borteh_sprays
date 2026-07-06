-- =====================================================================
-- Referral loop, made visible. The mechanics worked but failed silently:
-- signup swallowed apply errors, nobody was told anything until a first
-- DELIVERED order, and the admin had no view of it at all.
--
-- 1. fn_check_referral(code) — pre-signup validation (anon-callable),
--    returns the referrer's first name so the form can confirm the code
--    BEFORE creating the account.
-- 2. fn_apply_referral now notifies the referrer the moment their code
--    is used ("X joined — points arrive with their first delivered
--    order"), so the wait until delivery is understood, not a mystery.
-- =====================================================================

create or replace function public.fn_check_referral(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select split_part(coalesce(display_name, 'A friend'), ' ', 1)
    into v_name
    from public.app_user
   where referral_code = upper(btrim(p_code)) and not is_blocked;
  if v_name is null then raise exception 'invalid_code'; end if;
  return v_name;
end;
$$;

grant execute on function public.fn_check_referral(text) to anon, authenticated;

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
  v_new  text;
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

  -- Tell the referrer their code landed — and when the points will.
  select split_part(coalesce(display_name, 'Someone'), ' ', 1) into v_new
    from public.app_user where id = v_uid;
  insert into public.notification (user_id, type, channel, title, body, status)
  values (v_ref, 'system', 'in_app',
          v_new || ' joined with your code',
          'Your thank-you points arrive when their first order is delivered.',
          'delivered');

  return v_name;
end;
$$;

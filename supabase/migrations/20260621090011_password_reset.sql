-- 20260621090011_password_reset.sql
-- Phone + name password recovery (no SMS/OTP budget, ADR-004). The caller proves ownership by
-- matching the phone to the name on the account; on success we re-hash the password straight
-- into auth.users (bcrypt, GoTrue-compatible). Weak by design — acceptable for this market.
-- Callable by anon (the user is signed out while resetting).

create or replace function public.fn_reset_password(p_phone text, p_name text, p_new_password text)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
begin
  if length(coalesce(p_new_password, '')) < 6 then
    raise exception 'password too short';
  end if;

  select id into v_id
    from public.app_user
   where phone = btrim(p_phone)
     and lower(btrim(display_name)) = lower(btrim(p_name))
     and is_blocked = false;

  if v_id is null then
    raise exception 'no_match';
  end if;

  update auth.users
     set encrypted_password = crypt(p_new_password, gen_salt('bf')),
         updated_at = now()
   where id = v_id;

  return true;
end;
$$;

revoke all on function public.fn_reset_password(text, text, text) from public;
grant execute on function public.fn_reset_password(text, text, text) to anon, authenticated;

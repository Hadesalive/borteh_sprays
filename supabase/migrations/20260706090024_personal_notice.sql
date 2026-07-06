-- =====================================================================
-- Personal notices — staff message ONE customer's inbox (and lock screen,
-- via the existing trg_push_notification). RLS already guarantees only
-- that customer ever sees the row; this is just the staff-gated writer.
--
-- First wired use: issuing a personal coupon from the admin notifies the
-- customer ("15% off, just for you — BS-XX7K2"). Generic on purpose —
-- any one-to-one message rides the same function.
-- =====================================================================

create or replace function public.fn_notify_user(
  p_user_id uuid,
  p_title   text,
  p_body    text,
  p_kind    text default 'promo'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'not_authorized';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'title_and_body_required';
  end if;
  if p_kind not in ('system','promo') then
    raise exception 'bad_kind';
  end if;
  if not exists (select 1 from public.app_user where id = p_user_id) then
    raise exception 'no_such_user';
  end if;

  insert into public.notification (user_id, type, channel, title, body, status)
  values (p_user_id, p_kind, 'in_app', trim(p_title), trim(p_body), 'delivered')
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.fn_notify_user(uuid, text, text, text) to authenticated;

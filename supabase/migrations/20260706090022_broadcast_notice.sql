-- =====================================================================
-- Public notices — staff broadcast to every customer's inbox (and, via the
-- existing trg_push_notification on each inserted row, their lock screen).
--
--   select public.fn_broadcast_notice('Closed for Eid',
--     'The counter rests Monday — orders resume Tuesday morning.');
--
-- kind:     'system' (operational notice, everyone) | 'promo' (marketing —
--           in-app row still lands, but the push trigger only pushes promos
--           to marketing_opt_in users)
-- audience: 'all' customers | 'marketing' (opted-in only, for promo blasts)
-- Returns the number of recipients. Staff/owner only.
-- =====================================================================

create or replace function public.fn_broadcast_notice(
  p_title    text,
  p_body     text,
  p_kind     text default 'system',
  p_audience text default 'all'
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
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
  if p_audience not in ('all','marketing') then
    raise exception 'bad_audience';
  end if;

  insert into public.notification (user_id, type, channel, title, body, status)
  select u.id, p_kind, 'in_app', trim(p_title), trim(p_body), 'delivered'
    from public.app_user u
    left join public.notification_preference np on np.user_id = u.id
   where u.role = 'customer'
     and not u.is_blocked
     and (p_audience = 'all' or coalesce(np.marketing_opt_in, false));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Callable by staff through the API; the function itself re-checks is_staff().
grant execute on function public.fn_broadcast_notice(text, text, text, text) to authenticated;

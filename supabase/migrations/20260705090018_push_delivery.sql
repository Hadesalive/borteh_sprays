-- =====================================================================
-- Push delivery (Phase B) — mirror every inbox notification to the user's
-- device through the FREE Expo push service (no paid comms APIs, ADR).
--
-- Design: a pg_net fire-and-forget POST from an after-insert trigger —
-- no Edge Function, no webhook dashboard config, no queue. At this shop's
-- volume (a handful of notifications a day) that is deliberately enough.
-- The device token lives where the day-one schema put it:
-- notification_preference.push_token (+ push_enabled / marketing_opt_in).
--
-- Failure posture: if pg_net or Expo hiccups, the push is lost but the
-- inbox row already exists — in-app delivery never depends on this.
-- =====================================================================

create extension if not exists pg_net;

create or replace function public.fn_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pref  record;
  v_badge int;
begin
  select push_enabled, push_token, marketing_opt_in
    into pref
    from public.notification_preference
   where user_id = new.user_id;

  if not found or pref.push_token is null or not pref.push_enabled then
    return new;
  end if;
  -- promos only reach people who opted into marketing
  if new.type = 'promo' and not coalesce(pref.marketing_opt_in, false) then
    return new;
  end if;

  -- app-icon badge = unread count (this row is already inserted, so it counts itself)
  select count(*)::int into v_badge
    from public.notification
   where user_id = new.user_id and read_at is null;

  perform net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
      'to',    pref.push_token,
      'title', coalesce(new.title, 'Borteh'),
      'body',  new.body,
      'sound', 'default',
      'badge', v_badge,
      'data',  jsonb_build_object(
        'type',            new.type,
        'reference_type',  new.reference_type,
        'reference_id',    new.reference_id,
        'notification_id', new.id
      )
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_push_notification on public.notification;
create trigger trg_push_notification
  after insert on public.notification
  for each row execute function public.fn_push_notification();

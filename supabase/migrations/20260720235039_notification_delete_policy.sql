-- 20260720235039_notification_delete_policy.sql
-- Let a signed-in user delete their OWN notifications (inbox swipe-to-delete + clear-all).
-- The table had select + update (mark-read) policies for the owner but no delete, so a client
-- delete was silently blocked by RLS. Staff already have `for all` via notif_staff.

create policy notif_del on public.notification
  for delete to authenticated
  using (user_id = auth.uid());

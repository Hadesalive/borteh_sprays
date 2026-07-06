-- =====================================================================
-- fn_my_referrals — the caller's invite list for the app: everyone who
-- signed up with their code (even before ordering), first names only
-- (privacy: no phones/emails cross accounts), with reward state derived
-- from the ledger's idempotency key.
-- =====================================================================

create or replace function public.fn_my_referrals()
returns table(first_name text, joined_at timestamptz, rewarded boolean)
language sql
stable
security definer
set search_path = public
as $$
  select split_part(coalesce(u.display_name, 'Someone'), ' ', 1),
         u.created_at,
         exists (
           select 1 from public.loyalty_ledger ll
            where ll.user_id = auth.uid()
              and ll.reason = 'referral:' || u.id
         )
    from public.app_user u
   where u.referred_by = auth.uid()
   order by u.created_at desc;
$$;

grant execute on function public.fn_my_referrals() to authenticated;

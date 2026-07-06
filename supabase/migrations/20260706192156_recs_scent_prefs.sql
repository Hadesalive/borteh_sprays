-- 20260706192156_recs_scent_prefs.sql
-- Explicit scent preferences captured at onboarding (Spotify-style bubble picker) and editable
-- in settings. Stored as TEXT so a preference survives even for a family/note the catalog does
-- not carry yet — the day a matching product arrives, the user is already personalized. Setting
-- prefs SEEDS the taste vector (cold start); the nightly rollup overwrites it from real
-- engagement once events accrue ("seed only, behavior wins").

create table if not exists recs.user_scent_prefs (
  user_id    uuid not null,
  kind       text not null,                 -- 'scent' (family/note/vibe) | 'gender'
  value      text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, value)
);
alter table recs.user_scent_prefs enable row level security;   -- server-only; service_role bypasses
grant select, insert, update, delete on recs.user_scent_prefs to service_role;

-- Replace the caller's prefs and seed their taste vector from products matching ANY chosen
-- value across family / accords / notes (broad ILIKE so "Vanilla" catches "Oriental Vanilla").
-- Returns how many products matched (0 = nothing in the catalog yet — prefs still saved).
create or replace function public.fn_set_scent_prefs(p_values text[], p_gender text default null)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_vec vector(384);
  v_n   integer;
begin
  if v_uid is null then return 0; end if;

  delete from recs.user_scent_prefs where user_id = v_uid;
  insert into recs.user_scent_prefs (user_id, kind, value)
    select v_uid, 'scent', btrim(v) from unnest(coalesce(p_values, '{}')) v where coalesce(btrim(v), '') <> ''
  on conflict do nothing;
  if coalesce(btrim(p_gender), '') <> '' then
    insert into recs.user_scent_prefs (user_id, kind, value) values (v_uid, 'gender', p_gender) on conflict do nothing;
  end if;

  select l2_normalize(sum(p.embedding)), count(*)
    into v_vec, v_n
  from public.product p
  where p.is_active and p.deleted_at is null and p.embedding is not null
    and (p_gender is null or p_gender = 'unisex' or p.gender = p_gender or p.gender = 'unisex')
    and exists (
      select 1 from unnest(coalesce(p_values, '{}')) val
      where p.scent_family ilike '%' || val || '%'
         or exists (select 1 from unnest(p.main_accords) a where a ilike '%' || val || '%')
         or exists (select 1 from public.product_scent_note psn
                    join public.scent_note sn on sn.id = psn.scent_note_id
                    where psn.product_id = p.id and sn.name ilike '%' || val || '%')
    );

  if v_vec is not null then
    insert into recs.user_profile (user_id, taste_embedding, refreshed_at)
      values (v_uid, v_vec, now())
    on conflict (user_id) do update set taste_embedding = excluded.taste_embedding, refreshed_at = now();
  end if;
  return coalesce(v_n, 0);
end;
$$;

-- Read back the caller's prefs (recs is unexposed, so settings needs an RPC to pre-fill the picker).
create or replace function public.fn_get_scent_prefs()
returns table(kind text, value text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select kind, value from recs.user_scent_prefs where user_id = auth.uid();
$$;

revoke all on function public.fn_set_scent_prefs(text[], text) from public;
revoke all on function public.fn_get_scent_prefs() from public;
grant execute on function public.fn_set_scent_prefs(text[], text) to authenticated;
grant execute on function public.fn_get_scent_prefs() to authenticated;

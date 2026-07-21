-- 20260720225345_quiz_scent_prefs.sql
-- Richer onboarding scent quiz. Extends the existing explicit-preference capture (from
-- 20260706192156_recs_scent_prefs.sql) so the quiz can record loved AND avoided scents plus
-- a few soft dimensions (intensity, sweetness, occasion, budget), and seeds a sharper taste
-- vector that rotates AWAY from disliked scents rather than merely omitting them.
--
-- Design notes:
--   * No new table — recs.user_scent_prefs already keys on (user_id, kind, value) with free-text
--     kind, so 'avoid' / 'intensity' / 'sweetness' / 'occasion' / 'budget' need no schema change.
--     A `weight` column is added for future weighted loves (default 1, additive).
--   * The old fn_set_scent_prefs stays for the settings picker and back-compat. "Seed only,
--     behavior wins": the nightly rollup overwrites taste_embedding from real engagement.
--   * Taste seed = l2_normalize( Lc − Ac·0.5 ), Lc/Ac the unit centroids of loved / avoided
--     matches. The 0.5 scale reuses the array_fill(k,[384])::vector trick already proven in
--     20260706090025_recs_taste_vectors.sql (pgvector has no scalar-broadcast operator).

alter table recs.user_scent_prefs
  add column if not exists weight numeric not null default 1;

-- Replace the caller's prefs from a quiz submission and seed their taste vector.
--   p_loved   family/note/vibe terms to move TOWARD (stored kind='scent')
--   p_avoided family/note/vibe terms to move AWAY from (stored kind='avoid')
--   p_gender  'male' | 'female' | 'unisex' | null
--   p_dims    jsonb of soft signals, stored verbatim as their own kinds, e.g.
--             {"intensity":"bold","sweetness":"sweet","occasion":["office","date_night"],"budget":"mid"}
--             Scalars → one row; arrays → one row per element. Captured for later ranking/filter.
-- Returns the number of loved-matching products (0 = nothing in catalog yet; prefs still saved).
create or replace function public.fn_set_quiz_prefs(
  p_loved   text[],
  p_avoided text[]  default '{}',
  p_gender  text    default null,
  p_dims    jsonb   default '{}'
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_loved   vector(384);
  v_avoid   vector(384);
  v_taste   vector(384);
  v_n       integer;
  v_key     text;
  v_val     jsonb;
begin
  if v_uid is null then return 0; end if;

  -- ---- replace stored prefs -------------------------------------------------------------
  delete from recs.user_scent_prefs where user_id = v_uid;

  insert into recs.user_scent_prefs (user_id, kind, value)
    select v_uid, 'scent', btrim(v)
      from unnest(coalesce(p_loved, '{}')) v
     where coalesce(btrim(v), '') <> ''
  on conflict do nothing;

  insert into recs.user_scent_prefs (user_id, kind, value)
    select v_uid, 'avoid', btrim(v)
      from unnest(coalesce(p_avoided, '{}')) v
     where coalesce(btrim(v), '') <> ''
  on conflict do nothing;

  if coalesce(btrim(p_gender), '') <> '' then
    insert into recs.user_scent_prefs (user_id, kind, value)
      values (v_uid, 'gender', p_gender)
    on conflict do nothing;
  end if;

  -- soft dimensions: scalar → one row; array → one row per element
  for v_key, v_val in select * from jsonb_each(coalesce(p_dims, '{}'::jsonb)) loop
    if jsonb_typeof(v_val) = 'array' then
      insert into recs.user_scent_prefs (user_id, kind, value)
        select v_uid, v_key, btrim(e.val)
          from jsonb_array_elements_text(v_val) e(val)
         where coalesce(btrim(e.val), '') <> ''
      on conflict do nothing;
    elsif v_val is not null and jsonb_typeof(v_val) <> 'null' then
      insert into recs.user_scent_prefs (user_id, kind, value)
        values (v_uid, v_key, btrim(v_val #>> '{}'))
      on conflict do nothing;
    end if;
  end loop;

  -- ---- seed the taste vector ------------------------------------------------------------
  -- Unit centroid of loved-matching products (gender-respecting). ILIKE '%term%' so a broad
  -- pick like "Vanilla" also catches "Oriental Vanilla" families / notes.
  select l2_normalize(sum(p.embedding))
    into v_loved
  from public.product p
  where p.is_active and p.deleted_at is null and p.embedding is not null
    and (p_gender is null or p_gender = 'unisex' or p.gender = p_gender or p.gender = 'unisex')
    and exists (
      select 1 from unnest(coalesce(p_loved, '{}')) val
      where p.scent_family ilike '%' || val || '%'
         or exists (select 1 from unnest(p.main_accords) a where a ilike '%' || val || '%')
         or exists (select 1 from public.product_scent_note psn
                    join public.scent_note sn on sn.id = psn.scent_note_id
                    where psn.product_id = p.id and sn.name ilike '%' || val || '%')
    );

  -- Unit centroid of avoided-matching products (gender ignored — a disliked note is disliked
  -- regardless of who a bottle is marketed to).
  select l2_normalize(sum(p.embedding))
    into v_avoid
  from public.product p
  where p.is_active and p.deleted_at is null and p.embedding is not null
    and exists (
      select 1 from unnest(coalesce(p_avoided, '{}')) val
      where p.scent_family ilike '%' || val || '%'
         or exists (select 1 from unnest(p.main_accords) a where a ilike '%' || val || '%')
         or exists (select 1 from public.product_scent_note psn
                    join public.scent_note sn on sn.id = psn.scent_note_id
                    where psn.product_id = p.id and sn.name ilike '%' || val || '%')
    );

  -- Combine: toward loved, half-step away from avoided. Each term is optional.
  if v_loved is not null and v_avoid is not null then
    v_taste := l2_normalize(v_loved - (v_avoid * (array_fill(0.5::float8, array[384]))::vector));
  elsif v_loved is not null then
    v_taste := v_loved;
  elsif v_avoid is not null then
    -- only dislikes given: point away from them
    v_taste := l2_normalize((array_fill(-1::float8, array[384]))::vector * v_avoid);
  else
    v_taste := null;
  end if;

  if v_taste is not null then
    insert into recs.user_profile (user_id, taste_embedding, refreshed_at)
      values (v_uid, v_taste, now())
    on conflict (user_id) do update
      set taste_embedding = excluded.taste_embedding, refreshed_at = now();
  end if;

  -- count of loved-matching products (informational; drives the result-card copy)
  select count(*)
    into v_n
  from public.product p
  where p.is_active and p.deleted_at is null
    and (p_gender is null or p_gender = 'unisex' or p.gender = p_gender or p.gender = 'unisex')
    and exists (
      select 1 from unnest(coalesce(p_loved, '{}')) val
      where p.scent_family ilike '%' || val || '%'
         or exists (select 1 from unnest(p.main_accords) a where a ilike '%' || val || '%')
         or exists (select 1 from public.product_scent_note psn
                    join public.scent_note sn on sn.id = psn.scent_note_id
                    where psn.product_id = p.id and sn.name ilike '%' || val || '%')
    );

  return coalesce(v_n, 0);
end;
$$;

revoke all on function public.fn_set_quiz_prefs(text[], text[], text, jsonb) from public, anon;
grant execute on function public.fn_set_quiz_prefs(text[], text[], text, jsonb) to authenticated;

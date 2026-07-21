-- 20260720221809_recs_cold_start_correctness.sql
-- Makes the recommendation stack correct for a REAL vendor catalog with no interaction history
-- yet. Everything here targets one of four defects exposed by the 2026-07-20 catalog replacement:
--
--   1. popularity_score had NO writer anywhere in the codebase (only the June demo seed ever set
--      it). 125 of 140 live products sat at exactly 0, tied, and fell through to `order by p.id`
--      — i.e. ~89% of the shop was in random UUID order. Fixed by fn_refresh_popularity(), which
--      blends real engagement with a cold-start quality prior so a fresh catalog is never flat.
--   2. fn_trending returned ZERO ROWS (HTTP 200, empty) because its 7-day window found nothing.
--      It is the universal fallback rail in mobile/lib/feed.ts, so the home feed silently lost
--      its algorithmic row. Fixed by widening 7 → 30 → 90 days and finally falling back to
--      popularity, so it can never come back empty while sellable stock exists.
--   3. fn_shop_ranked had no diversity control. With 46 of 140 products from one house, the
--      first page was a wall of Lattafa. Fixed with a rank-within-brand penalty.
--   4. Embedding staleness was undetectable: writing an embedding is itself an UPDATE, so
--      set_updated_at bumped updated_at ~300ms AFTER embedded_at and every product looked
--      permanently stale (the nightly job re-embedded all 140 every night). Separately, a
--      scent-note rewrite did NOT touch product.updated_at, so a notes-only change was invisible
--      to both the embed job and the dispatch trigger. Both fixed by content_updated_at, a marker
--      touched ONLY by genuine editorial change — including note pyramids.
--
-- Safe to re-run. No data is destroyed; popularity_score is recomputed, not hand-edited.

-- =====================================================================
-- 1. content_updated_at — a precise "the text a human/embedding cares about changed" marker
-- =====================================================================
alter table public.product
  add column if not exists content_updated_at timestamptz;

-- Seed it so the first post-migration embed run has a sane baseline instead of treating
-- every product as never-embedded.
update public.product
   set content_updated_at = coalesce(content_updated_at, updated_at, created_at, now())
 where content_updated_at is null;

create or replace function public.fn_touch_product_content()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  new.content_updated_at := now();
  return new;
end;
$$;

-- Editorial columns only — deliberately the same set the embed-dispatch trigger watches, so
-- "what triggers a re-embed" and "what marks content stale" can never drift apart.
drop trigger if exists trg_product_content_touch on public.product;
create trigger trg_product_content_touch
  before update on public.product
  for each row
  when (
       old.name          is distinct from new.name
    or old.scent_family  is distinct from new.scent_family
    or old.description   is distinct from new.description
    or old.main_accords  is distinct from new.main_accords
    or old.brand_id      is distinct from new.brand_id
    or old.category_id   is distinct from new.category_id
    or old.gender        is distinct from new.gender
  )
  execute function public.fn_touch_product_content();

drop trigger if exists trg_product_content_ins on public.product;
create trigger trg_product_content_ins
  before insert on public.product
  for each row execute function public.fn_touch_product_content();

-- A note-pyramid rewrite changes the embedding input but lives in another table, so propagate it.
-- NEW is unassigned on DELETE (and OLD on INSERT), so branch on TG_OP rather than coalescing
-- the two — reading the unassigned one raises at runtime.
create or replace function public.fn_touch_product_content_from_note()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  v_product_id uuid;
begin
  if tg_op = 'DELETE' then
    v_product_id := old.product_id;
  else
    v_product_id := new.product_id;
  end if;

  update public.product
     set content_updated_at = now()
   where id = v_product_id;

  return null;   -- AFTER trigger: return value is ignored
end;
$$;

drop trigger if exists trg_psn_content_touch on public.product_scent_note;
create trigger trg_psn_content_touch
  after insert or delete on public.product_scent_note
  for each row execute function public.fn_touch_product_content_from_note();

-- =====================================================================
-- 2. popularity_score gets a real writer
-- =====================================================================
-- score = 1000 × ( 0.70 × normalised 90-day decayed engagement
--                + 0.30 × cold-start prior )
--
-- The prior exists so a catalog with zero traffic still has a defensible order instead of a
-- 125-way tie. Its weights encode what the shop actually knows before anyone clicks:
--   photo 0.35    the owner has photographed it — it renders a real bottle rather than the
--                 app's family-matched stand-in (which shows a DIFFERENT perfume), so it both
--                 presents better and signals stock the shop is actively merchandising.
--   recency 0.30  newer releases carry demand in this market.
--   rating 0.20   real review signal where it exists.
--   featured 0.15 explicit owner curation.
-- Engagement outranks the prior 0.70/0.30, so genuine traffic overtakes these guesses as soon
-- as it arrives — the prior fades on its own, it does not need to be removed later.
create or replace function public.fn_refresh_popularity()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_weights   jsonb;
  v_half_life numeric;
  v_written   int;
begin
  select coalesce(value, '{}'::jsonb) into v_weights
    from recs.config where key = 'feedback.weights';
  select coalesce((value #>> '{}')::numeric, 14) into v_half_life
    from recs.config where key = 'recency.half_life_days';
  if coalesce(v_half_life, 0) <= 0 then
    v_half_life := 14;
  end if;

  with eng as (
    select e.product_id,
           sum(
             greatest(coalesce((v_weights ->> e.event_type)::numeric, 0), 0)
             * exp(- extract(epoch from (now() - e.created_at)) / 86400.0 / v_half_life)
           ) as w
      from recs.events e
     where e.product_id is not null
       and e.created_at >= now() - interval '90 days'
     group by e.product_id
  ),
  yr as (
    select min(release_year) as min_y, max(release_year) as max_y
      from public.product
     where is_active and deleted_at is null and release_year is not null
  ),
  base as (
    select p.id,
           coalesce(e.w, 0) as eng,
           (case when exists (select 1 from public.product_image pi where pi.product_id = p.id)
                 then 1 else 0 end)::numeric as has_photo,
           (case when p.is_featured then 1 else 0 end)::numeric as featured,
           (case when p.release_year is null or yr.max_y is null or yr.max_y = yr.min_y then 0.5
                 else (p.release_year - yr.min_y)::numeric / (yr.max_y - yr.min_y) end) as recency,
           (coalesce(p.avg_rating, 0) / 5.0)::numeric as rating
      from public.product p
      cross join yr
      left join eng e on e.product_id = p.id
     where p.is_active and p.deleted_at is null
  ),
  norm as (select coalesce(max(eng), 0) as max_eng from base),
  scored as (
    select b.id,
           round(1000 * (
               0.70 * (case when n.max_eng > 0 then b.eng / n.max_eng else 0 end)
             + 0.30 * (0.35 * b.has_photo + 0.15 * b.featured + 0.30 * b.recency + 0.20 * b.rating)
           ))::int as score
      from base b cross join norm n
  )
  update public.product p
     set popularity_score = s.score
    from scored s
   where p.id = s.id
     and p.popularity_score is distinct from s.score;

  get diagnostics v_written = row_count;
  return v_written;
end;
$$;

revoke all on function public.fn_refresh_popularity() from public, anon, authenticated;
grant execute on function public.fn_refresh_popularity() to service_role;

-- =====================================================================
-- 3. fn_trending — must never return an empty rail
-- =====================================================================
create or replace function public.fn_trending(p_limit int default 20)
returns table(product_id uuid, score numeric)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_weights jsonb;
  v_days    int;
begin
  select coalesce(value, '{}'::jsonb) into v_weights
    from recs.config where key = 'feedback.weights';

  -- Widen the window before giving up. A shop that is quiet for a week, or one whose catalog
  -- was just replaced, still has a meaningful 30/90-day signal.
  foreach v_days in array array[7, 30, 90] loop
    return query
      select e.product_id,
             sum(greatest(coalesce((v_weights ->> e.event_type)::numeric, 0), 0))::numeric as score
        from recs.events e
        join public.product p on p.id = e.product_id
       where e.product_id is not null
         and e.created_at >= now() - make_interval(days => v_days)
         and p.is_active and p.deleted_at is null
         and exists (
           select 1
             from public.product_variant pv
             join public.availability_signal a on a.variant_id = pv.id
            where pv.product_id = p.id and pv.is_active and pv.deleted_at is null
              and a.band <> 'out'
         )
       group by e.product_id
      having sum(greatest(coalesce((v_weights ->> e.event_type)::numeric, 0), 0)) > 0
       order by 2 desc
       limit greatest(coalesce(p_limit, 20), 0);

    -- FOUND is documented as being set by RETURN QUERY: true when that query yielded ≥1 row.
    -- Nothing runs between the query and this check, so it cannot be clobbered.
    if found then
      return;
    end if;
  end loop;

  -- Nothing engaged in 90 days (a brand-new catalog). Fall back to popularity so the rail shows
  -- the shop's best sellable stock rather than nothing at all.
  return query
    select p.id, (p.popularity_score::numeric / 1000.0) as score
      from public.product p
     where p.is_active and p.deleted_at is null
       and exists (
         select 1
           from public.product_variant pv
           join public.availability_signal a on a.variant_id = pv.id
          where pv.product_id = p.id and pv.is_active and pv.deleted_at is null
            and a.band <> 'out'
       )
     order by p.popularity_score desc, p.id
     limit greatest(coalesce(p_limit, 20), 0);
end;
$$;

-- =====================================================================
-- 4. fn_shop_ranked — same blend, plus brand diversity
-- =====================================================================
-- Unchanged scoring; adds a penalty by rank-within-brand so one dominant house cannot occupy
-- the whole first page. Penalty is computed over the full active set, and the final sort keeps
-- a deterministic p.id tiebreak, so offset pagination stays stable and never repeats or skips.
create or replace function public.fn_shop_ranked(p_limit int default 24, p_offset int default 0)
returns table(product_id uuid, score numeric)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_blend      jsonb;
  w_content    numeric;
  w_trending   numeric;
  v_div_step   numeric;
  v_div_cap    numeric;
begin
  select value into v_blend from recs.config where key = 'blend.weights';
  v_blend    := coalesce(v_blend, '{}'::jsonb);
  w_content  := coalesce((v_blend ->> 'content')::numeric,  1.0);
  w_trending := coalesce((v_blend ->> 'trending')::numeric, 0.5);
  v_div_step := coalesce((v_blend ->> 'brand_diversity_step')::numeric, 0.04);
  v_div_cap  := coalesce((v_blend ->> 'brand_diversity_cap')::numeric,  0.20);

  return query
  with me as (
    select taste_embedding from recs.user_profile where user_id = auth.uid()
  ),
  norm as (
    select greatest(max(popularity_score), 1) as max_pop,
           greatest(max(review_count), 1)     as max_rev
      from public.product
     where is_active and deleted_at is null
  ),
  base as (
    select p.id, p.brand_id,
      (
          w_content * coalesce(
            case when me.taste_embedding is not null and p.embedding is not null
                 then 1 - (p.embedding <=> me.taste_embedding) end, 0)
        + w_trending * (p.popularity_score::numeric / norm.max_pop)
        + 0.5 * (p.avg_rating / 5.0) * (ln(1 + p.review_count) / ln(1 + norm.max_rev))
      )::numeric as raw_score
      from public.product p
      cross join norm
      left join me on true
     where p.is_active and p.deleted_at is null
  ),
  div as (
    select b.id,
           b.raw_score,
           least(
             v_div_step * (row_number() over (partition by b.brand_id
                                              order by b.raw_score desc, b.id) - 1),
             v_div_cap
           ) as penalty
      from base b
  )
  select d.id, (d.raw_score - d.penalty)::numeric as score
    from div d
   order by (d.raw_score - d.penalty) desc, d.id
   limit greatest(coalesce(p_limit, 24), 0)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

grant execute on function public.fn_shop_ranked(int, int) to anon, authenticated;
grant execute on function public.fn_trending(int)         to anon, authenticated;

-- =====================================================================
-- 5. Cron ordering — derived data must refresh AFTER the thing it derives from
-- =====================================================================
-- Embeddings are rebuilt by the GitHub Action at 03:00 UTC. The taste-vector rollup consumes
-- product.embedding, so running it at 02:00 baked in vectors up to 24h stale after every
-- catalog change. Everything derived now runs after the embed job.
do $$
begin
  perform cron.schedule('recs-refresh-user-profiles', '0 4 * * *',  'select recs.fn_refresh_user_profiles();');
  perform cron.schedule('recs-refresh-cf',            '30 4 * * *', 'select recs.fn_refresh_cf_candidates();');
  perform cron.schedule('recs-refresh-popularity',    '45 4 * * *', 'select public.fn_refresh_popularity();');
exception when others then
  raise notice 'pg_cron unavailable — schedule these manually: profiles 04:00, cf 04:30, popularity 04:45 UTC';
end $$;

-- =====================================================================
-- 6. CF training must ignore retired stock
-- =====================================================================
-- Body is byte-identical to migration 20260706151536 apart from the added product join
-- below (extracted and patched programmatically, not retyped). Serving already filtered,
-- so this was wasteful rather than user-visible — but once real traffic lands on the new
-- catalog, training over dead products would quietly degrade every CF recommendation.
create or replace function recs.fn_refresh_cf_candidates()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_weights jsonb;
  v_users   int;
  v_top     numeric;
  v_written int;
  v_version timestamptz := now();
begin
  select coalesce(value, '{}'::jsonb) into v_weights from recs.config where key = 'feedback.weights';

  -- positive per-(user,product) engagement
  drop table if exists _cf_ui;
  create temporary table _cf_ui on commit drop as
    select e.user_id, e.product_id,
           sum(greatest(coalesce((v_weights ->> e.event_type)::numeric, 0), 0)) as w
    from recs.events e
    -- Soft-deleted / retired products must never enter the item-item matrix: after a catalog
    -- replacement the entire event log points at dead stock, and training over it produces a
    -- model whose neighbours can never be served.
    join public.product p on p.id = e.product_id and p.is_active and p.deleted_at is null
    where e.user_id is not null and e.product_id is not null
    group by e.user_id, e.product_id
    having sum(greatest(coalesce((v_weights ->> e.event_type)::numeric, 0), 0)) > 0;

  -- Guardrails: need ≥2 distinct users, and no single product may exceed 50% of interactions.
  select count(distinct user_id) into v_users from _cf_ui;
  select coalesce(max(cnt)::numeric / nullif(sum(cnt), 0), 1) into v_top
    from (select product_id, count(*) as cnt from _cf_ui group by product_id) t;
  if coalesce(v_users, 0) < 2 or coalesce(v_top, 1) > 0.5 then
    return 0;   -- degenerate; keep the previous model
  end if;

  -- item-item cosine similarity from co-engagement
  drop table if exists _cf_sim;
  create temporary table _cf_sim on commit drop as
    with norms as (select product_id, sqrt(sum(w * w)) as nrm from _cf_ui group by product_id)
    select a.product_id as i, b.product_id as j,
           sum(a.w * b.w) / nullif(na.nrm * nb.nrm, 0) as sim
    from _cf_ui a
    join _cf_ui b on a.user_id = b.user_id and a.product_id <> b.product_id
    join norms na on na.product_id = a.product_id
    join norms nb on nb.product_id = b.product_id
    group by a.product_id, b.product_id, na.nrm, nb.nrm;

  -- per-user top-50 candidates = Σ sim(engaged_i, candidate_j) × engagement, excluding engaged
  with scored as (
    select ui.user_id, s.j as product_id, sum(s.sim * ui.w) as score,
           row_number() over (partition by ui.user_id order by sum(s.sim * ui.w) desc) as rn
    from _cf_ui ui
    join _cf_sim s on s.i = ui.product_id
    where not exists (select 1 from _cf_ui x where x.user_id = ui.user_id and x.product_id = s.j)
    group by ui.user_id, s.j
  )
  insert into recs.cf_candidates (user_id, product_id, score, model_version, created_at)
  select user_id, product_id, score::real, v_version, now() from scored where rn <= 50
  on conflict (user_id, product_id) do update
    set score = excluded.score, model_version = excluded.model_version, created_at = now();

  get diagnostics v_written = row_count;
  delete from recs.cf_candidates where model_version < v_version;  -- drop rows not regenerated
  return v_written;
end;
$$;
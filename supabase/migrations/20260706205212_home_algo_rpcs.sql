-- 20260706205212_home_algo_rpcs.sql
-- Home-algo track, CHUNK 1 — personalization + hybrid-search RPCs (see
-- HOME_ALGO_IMPLEMENTATION_PLAN.md §2). Powers: personalized Shop-by-note ordering, the
-- per-user featured-collection pick, the shop "For you" default sort, and natural-language
-- search that weighs reviews + attributes + personal taste.
--
-- All functions are public, SECURITY DEFINER, search_path=public — the recs schema stays
-- UNEXPOSED, so the app only ever reaches it through these wrappers. The caller is resolved
-- via auth.uid(); anon / cold-start callers get sensible non-personalized fallbacks. Tunables
-- (blend weights) are read from recs.config, never hardcoded. No new model / edge function /
-- re-embed — NL search is a pure SQL hybrid over the existing MiniLM embeddings + FTS.
--
-- Product FTS uses the 'simple' config (product.search_tsv is built with 'simple'), so search
-- queries MUST use websearch_to_tsquery('simple', …).

-- ---------------------------------------------------------------------------
-- fn_my_top_families() → (family, score)
-- The caller's weighted top scent families (recs.user_profile.top_families, already ordered
-- strongest-first by the nightly rollup). Drives the personalized Shop-by-note order.
-- Anon / cold-start → auth.uid() is null → no profile row → empty; the app then falls back to
-- the admin category sort_order.
-- ---------------------------------------------------------------------------
create or replace function public.fn_my_top_families()
returns table(family text, score numeric)
language sql
stable
security definer
set search_path to 'public'
as $$
  select (elem ->> 'family')          as family,
         (elem ->> 'score')::numeric   as score
  from recs.user_profile up
  cross join lateral jsonb_array_elements(up.top_families) as elem
  where up.user_id = auth.uid()
    and (elem ->> 'family') is not null
  order by (elem ->> 'score')::numeric desc nulls last;
$$;

-- ---------------------------------------------------------------------------
-- fn_rank_collections(p_slugs text[]) → (slug, affinity)
-- For the given curated collection slugs, average taste similarity
-- (1 - cosine distance) between the caller's taste vector and each collection's products,
-- ordered most-affinity first. The app curates the pool (featured collections) and this picks
-- which one to surface for THIS user. Anon / no taste vector → empty → app keeps admin order.
-- Collections whose products aren't embedded yet simply don't rank (omitted).
-- ---------------------------------------------------------------------------
create or replace function public.fn_rank_collections(p_slugs text[])
returns table(slug text, affinity numeric)
language sql
stable
security definer
set search_path to 'public'
as $$
  with me as (
    select taste_embedding from recs.user_profile where user_id = auth.uid()
  )
  select c.slug,
         avg(1 - (p.embedding <=> me.taste_embedding))::numeric as affinity
  from me
  join public.category c
    on c.slug = any(p_slugs) and c.deleted_at is null
  join public.product p
    on p.category_id = c.id
   and p.is_active and p.deleted_at is null and p.embedding is not null
  where me.taste_embedding is not null
  group by c.slug
  order by affinity desc;
$$;

-- ---------------------------------------------------------------------------
-- fn_shop_ranked(p_limit, p_offset) → (product_id, score)
-- The shop "For you / Featured" DEFAULT sort. Score blends:
--   content  * taste_sim(1 - cosine dist to taste vector)
-- + trending * normalized popularity_score
-- + a modest review boost (avg_rating × log review volume, normalized).
-- content/trending weights come from recs.config 'blend.weights'. Anon / cold-start → taste
-- term is 0 → pure popularity + review ranking. Active products only.
-- NOTE: the app uses this ONLY for the default (no-filter) sort; any explicit sort/filter
-- overrides it client-side — personalization never traps the user.
-- ---------------------------------------------------------------------------
create or replace function public.fn_shop_ranked(p_limit int default 24, p_offset int default 0)
returns table(product_id uuid, score numeric)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_blend    jsonb;
  w_content  numeric;
  w_trending numeric;
begin
  select value into v_blend from recs.config where key = 'blend.weights';
  v_blend    := coalesce(v_blend, '{}'::jsonb);
  w_content  := coalesce((v_blend ->> 'content')::numeric,  1.0);
  w_trending := coalesce((v_blend ->> 'trending')::numeric, 0.5);

  return query
  with me as (
    select taste_embedding from recs.user_profile where user_id = auth.uid()
  ),
  norm as (   -- maxima for 0..1 normalization of the non-similarity terms
    select greatest(max(popularity_score), 1) as max_pop,
           greatest(max(review_count), 1)      as max_rev
    from public.product
    where is_active and deleted_at is null
  )
  select p.id,
    (
        w_content * coalesce(
          case when me.taste_embedding is not null and p.embedding is not null
               then 1 - (p.embedding <=> me.taste_embedding) end, 0)
      + w_trending * (p.popularity_score::numeric / norm.max_pop)
      -- review boost: rating fraction × log-scaled, normalized volume (fixed 0.5 weight)
      + 0.5 * (p.avg_rating / 5.0) * (ln(1 + p.review_count) / ln(1 + norm.max_rev))
    )::numeric as score
  from public.product p
    cross join norm
    left join me on true
  where p.is_active and p.deleted_at is null
  order by score desc, p.popularity_score desc, p.id
  limit greatest(coalesce(p_limit, 24), 0)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- fn_search_products(p_query, p_limit) → (product_id, score)
-- Hybrid natural-language search. A product matches (WHERE) if ANY of:
--   • FTS: websearch_to_tsquery('simple', q) hits name/description (search_tsv), OR
--   • its scent_family / main_accords / scent_note names / brand name ILIKE-match the query
--     in either direction (query-contains-attribute or attribute-contains-query).
-- Score sums: FTS relevance + attribute/brand hits + review weight (rating × log volume)
-- + personal taste boost (signed-in only) + an in-stock nudge.
-- Pure SQL — no query embedding / model. "Vibe-only" semantic search is deferred.
-- Grant anon + authenticated; personalization applies only when signed in.
-- ---------------------------------------------------------------------------
create or replace function public.fn_search_products(p_query text, p_limit int default 40)
returns table(product_id uuid, score numeric)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_q   text := btrim(coalesce(p_query, ''));
  v_tsq tsquery;
begin
  if v_q = '' then
    return;   -- empty query → no rows
  end if;
  v_tsq := websearch_to_tsquery('simple', v_q);

  return query
  with me as (
    select taste_embedding from recs.user_profile where user_id = auth.uid()
  )
  select p.id,
    (
      -- full-text relevance over name + description
        coalesce(ts_rank(p.search_tsv, v_tsq), 0) * 4.0
      -- scent family match (both directions)
      + case when p.scent_family is not null
             and (p.scent_family ilike '%'||v_q||'%' or v_q ilike '%'||p.scent_family||'%')
             then 2.0 else 0 end
      -- main accords match
      + case when exists (
          select 1 from unnest(coalesce(p.main_accords, '{}'::text[])) as acc
          where acc ilike '%'||v_q||'%' or v_q ilike '%'||acc||'%')
          then 1.5 else 0 end
      -- scent-note name match
      + case when exists (
          select 1 from public.product_scent_note psn
          join public.scent_note sn on sn.id = psn.scent_note_id
          where psn.product_id = p.id
            and (sn.name ilike '%'||v_q||'%' or v_q ilike '%'||sn.name||'%'))
          then 1.5 else 0 end
      -- brand name match
      + case when b.name is not null
             and (b.name ilike '%'||v_q||'%' or v_q ilike '%'||b.name||'%')
             then 2.0 else 0 end
      -- review weight (rating × log review volume)
      + (p.avg_rating * ln(1 + p.review_count)) * 0.15
      -- personal taste boost (signed-in only)
      + coalesce(
          case when me.taste_embedding is not null and p.embedding is not null
               then 1 - (p.embedding <=> me.taste_embedding) end, 0) * 1.0
      -- in-stock nudge
      + case when exists (
          select 1 from public.product_variant pv
          join public.availability_signal a on a.variant_id = pv.id
          where pv.product_id = p.id and pv.is_active and pv.deleted_at is null and a.band <> 'out')
          then 0.5 else 0 end
    )::numeric as score
  from public.product p
    join public.brand b on b.id = p.brand_id
    left join me on true
  where p.is_active and p.deleted_at is null
    and (
         p.search_tsv @@ v_tsq
      or (p.scent_family is not null
          and (p.scent_family ilike '%'||v_q||'%' or v_q ilike '%'||p.scent_family||'%'))
      or exists (
          select 1 from unnest(coalesce(p.main_accords, '{}'::text[])) as acc
          where acc ilike '%'||v_q||'%' or v_q ilike '%'||acc||'%')
      or exists (
          select 1 from public.product_scent_note psn
          join public.scent_note sn on sn.id = psn.scent_note_id
          where psn.product_id = p.id
            and (sn.name ilike '%'||v_q||'%' or v_q ilike '%'||sn.name||'%'))
      or (b.name ilike '%'||v_q||'%' or v_q ilike '%'||b.name||'%')
    )
  order by score desc, p.popularity_score desc, p.id
  limit greatest(coalesce(p_limit, 40), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Personalized-only fns → authenticated; anon-friendly fns (default sort + search
-- both have non-personalized fallbacks) → anon + authenticated.
-- ---------------------------------------------------------------------------
revoke all on function public.fn_my_top_families()               from public;
revoke all on function public.fn_rank_collections(text[])        from public;
revoke all on function public.fn_shop_ranked(int, int)           from public;
revoke all on function public.fn_search_products(text, int)      from public;

grant execute on function public.fn_my_top_families()          to authenticated;
grant execute on function public.fn_rank_collections(text[])   to authenticated;
grant execute on function public.fn_shop_ranked(int, int)      to anon, authenticated;
grant execute on function public.fn_search_products(text, int) to anon, authenticated;

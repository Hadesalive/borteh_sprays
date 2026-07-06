-- 20260705090020_product_embeddings.sql
-- Phase 2.1/2.2 — content embeddings + nearest-neighbour "Similar scents".
-- pgvector is already enabled (20260705090013). Vectors are computed OFFLINE by
-- jobs/embed-products.mjs (all-MiniLM-L6-v2, 384-dim) and upserted here; never at request
-- time. embedded_at lets the job re-embed only stale products (updated_at > embedded_at).

alter table public.product
  add column if not exists embedding   vector(384),
  add column if not exists embedded_at timestamptz;

-- HNSW index for fast cosine nearest-neighbour search.
create index if not exists idx_product_embedding
  on public.product using hnsw (embedding vector_cosine_ops);

-- "Similar scents": nearest active products to a given product by cosine distance.
-- SECURITY INVOKER so catalog RLS applies naturally (only active, non-deleted rows visible).
-- Returns ids + distance; the app maps ids onto its already-loaded product data.
create or replace function public.fn_similar_products(p_product_id uuid, p_limit int default 8)
returns table(product_id uuid, distance real)
language sql
stable
set search_path to 'public'
as $$
  select p.id, (p.embedding <=> src.embedding)::real as distance
  from public.product p
  cross join (select embedding from public.product where id = p_product_id) src
  where p.id <> p_product_id
    and p.is_active
    and p.deleted_at is null
    and p.embedding is not null
    and src.embedding is not null
  order by p.embedding <=> src.embedding
  limit greatest(coalesce(p_limit, 8), 0);
$$;

grant execute on function public.fn_similar_products(uuid, int) to anon, authenticated;

-- 20260621090008_product_catalog_fields.sql
-- Catalog enrichment fields the mobile app already reads but the schema lacked.
-- mobile/lib/api.ts selects product.release_year, scent_family, main_accords;
-- without these the product query errors and the whole app home renders empty.
-- All nullable / additive (enrichment data, often absent for a given product).

alter table public.product
  add column if not exists release_year int,        -- drives "New arrivals" + shown on product
  add column if not exists scent_family text,       -- e.g. "Oriental", "Woody Spicy"
  add column if not exists main_accords text[];     -- strongest accords first, for chips

-- 20260617090005_product_images_bucket.sql
-- Public Storage bucket for product images (CDN-served), written by staff/service-role only.
-- The loader script uploads transparent PNGs here and sets product_image.storage_path.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Public read: anyone can fetch a product image over the CDN (catalog is public).
drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

-- Writes (upload/replace/delete) are staff/owner only; service_role bypasses RLS for the loader.
drop policy if exists "product_images_staff_write" on storage.objects;
create policy "product_images_staff_write"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'product-images' and public.is_staff())
  with check (bucket_id = 'product-images' and public.is_staff());

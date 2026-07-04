-- seed_storefront.sql — reproduce the app home EXACTLY as designed, now DB-driven.
-- Labels, copy, links and order match the home components 1:1. Image paths are
-- left null on purpose: the app serves its bundled art as the fallback (keyed by
-- slug / family / slide order), so the images are the exact ones shown today.
-- Idempotent — safe to re-run. Requires migrations 090006–090009 applied.
--
-- Apply: supabase db execute --file supabase/seed_storefront.sql
--    or: psql "$DATABASE_URL" -f supabase/seed_storefront.sql

-- HERO carousel — matches HomeHero's slides; bundled art shows in this order
-- (oud, gold, rose). Cleared first so re-running stays at three.
delete from public.home_carousel;
insert into public.home_carousel (label, title, cta_text, link_url, sort_order) values
  ('Signature',      'Scents that linger.', 'Shop the collection', '/shop',                 1),
  ('Amber & oud',    'Warmth that stays.',  'Shop warm scents',    '/shop?family=oriental', 2),
  ('Rose & jasmine', 'Florals in bloom.',   'Shop florals',        '/shop?family=floral',   3);

-- Classify taxonomy categories (gender + scent filters) so they're never
-- treated as home collections in the admin or the app rail.
update public.category set kind = 'taxonomy'  where slug in ('men','women','unisex','oud');
update public.category set kind = 'collection' where slug not in ('men','women','unisex','oud');

-- COLLECTIONS rail — the six occasion collections, in the home's order.
update public.category set is_featured_home = false where is_featured_home;
update public.category as cat
   set is_featured_home = true, sort_order = c.so
  from (values
    ('summer', 1),
    ('date-night', 2),
    ('oud-lovers', 3),
    ('gourmand-sweet', 4),
    ('office', 5),
    ('signature', 6)
  ) as c(slug, so)
 where cat.slug = c.slug and cat.deleted_at is null;

-- SHOP BY BRAND — feature the houses, ordered by catalog size, so the rail is curated.
update public.brand set is_featured_home = false, sort_order = 0 where deleted_at is null;
update public.brand as b
   set is_featured_home = true, sort_order = v.so
  from (values
    ('lattafa',1),('armaf',2),('maison-alhambra',3),('afnan',4),('al-haramain',5),
    ('rasasi',6),('swiss-arabian',7),('paris-corner',8),('ard-al-zaafaran',9),('french-avenue',10)
  ) as v(slug, so)
 where b.slug = v.slug and b.deleted_at is null;

-- SHOP BY SCENT — the six families, in the home's order.
insert into public.home_scent_family (family, label, sort_order) values
  ('woody', 'Woody', 1),
  ('floral', 'Floral', 2),
  ('oriental', 'Oriental', 3),
  ('spicy', 'Spicy', 4),
  ('citrus', 'Citrus', 5),
  ('sweet', 'Sweet', 6)
on conflict (family) do update
  set label = excluded.label, sort_order = excluded.sort_order, is_active = true;

-- IMAGES — point each section at Storage (product-images/home/…), uploaded by
-- scripts/load-home-images.sh. The app reads these; bundled art is only a fallback.
update public.home_carousel
   set image_path = case sort_order when 1 then 'home/hero/oud.jpg'
                                    when 2 then 'home/hero/gold.jpg'
                                    when 3 then 'home/hero/rose.jpg' end
 where deleted_at is null;
update public.category
   set cover_image_path = 'home/collections/' || slug || '.jpg'
 where slug in ('summer','date-night','oud-lovers','gourmand-sweet','office','signature');
update public.home_scent_family
   set image_path = 'home/scent/' || family || '.jpg'
 where family in ('woody','floral','oriental','spicy','citrus','sweet');
update public.brand
   set logo_path = 'home/brands/' || slug || '.png'
 where slug in ('afnan','al-haramain','ard-al-zaafaran','armaf','french-avenue',
                'lattafa','maison-alhambra','paris-corner','rasasi','swiss-arabian');

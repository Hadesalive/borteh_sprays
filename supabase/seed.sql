-- seed.sql — sample catalog for dev/demo. 8 REAL perfumes so every product has a real image
-- (loaded as transparent PNGs by scripts/load-product-images.mjs into the product-images bucket).
-- Money is SLE minor units (Le 1.00 = 100). Applied by `supabase db push --include-seed`.
-- NOTE: these brand/product images are owned by the brands; fine as DEV placeholders — replace
-- with the owner's own bottle photography or licensed shots before a public launch.

-- ---------- Store (single, default) ----------
insert into public.store_location (name, code, type, address_text, is_default, is_active)
values ('Borteh Sprays — Main', 'FT-MAIN', 'retail_store', 'Freetown', true, true)
on conflict (code) do nothing;

-- ---------- Brands (real) ----------
insert into public.brand (name, slug) values
  ('Lattafa', 'lattafa'),
  ('Armaf', 'armaf'),
  ('Maison Alhambra', 'maison-alhambra')
on conflict (slug) where deleted_at is null do nothing;

-- ---------- Categories ----------
insert into public.category (name, slug, sort_order) values
  ('Men', 'men', 1),
  ('Women', 'women', 2),
  ('Unisex', 'unisex', 3),
  ('Oud', 'oud', 4)
on conflict (slug) where deleted_at is null do nothing;

-- ---------- Scent notes ----------
insert into public.scent_note (name, note_family) values
  ('Oud','woody'), ('Rose','floral'), ('Vanilla','sweet'), ('Amber','oriental'),
  ('Musk','musky'), ('Bergamot','citrus'), ('Sandalwood','woody'), ('Jasmine','floral'),
  ('Saffron','spicy'), ('Pineapple','fruity')
on conflict (name) do nothing;

-- ---------- Products (8 real perfumes) ----------
insert into public.product (brand_id, category_id, name, slug, description, gender, is_featured)
select b.id, c.id, p.name, p.slug, p.descr, p.gender, p.featured
from (values
  ('lattafa',        'unisex', 'Asad',                    'asad',                    'Bold, leathery amber crowned with a bronze lion — an everyday statement scent.', 'unisex', true),
  ('lattafa',        'women',  'Yara',                    'yara',                    'Sweet tropical florals with orchid, heliotrope and creamy vanilla.',             'female', true),
  ('lattafa',        'unisex', 'Khamrah',                 'khamrah',                 'Warm spiced vanilla, dates and praline — cosy and addictive.',                   'unisex', true),
  ('lattafa',        'oud',    'Bade''e Al Oud Amethyst', 'badee-al-oud-amethyst',   'A bold rose-and-oud bomb wrapped in amber and vanilla.',                         'unisex', true),
  ('lattafa',        'men',    'Fakhar Black',            'fakhar-black',            'Crisp apple and bergamot over a warm amberwood drydown.',                        'male',   false),
  ('armaf',          'men',    'Club de Nuit Intense Man','club-de-nuit-intense-man','Smoky pineapple and birch — the crowd favourite.',                               'male',   true),
  ('armaf',          'men',    'Tres Nuit',               'tres-nuit',               'Fresh aromatic green — lemon, lavender and sandalwood.',                          'male',   false),
  ('maison-alhambra','unisex', 'Kismet Angel',            'kismet-angel',            'Gourmand sweetness with saffron, rose and vanilla.',                             'unisex', false)
) as p(brand_slug, cat_slug, name, slug, descr, gender, featured)
join public.brand b on b.slug = p.brand_slug
join public.category c on c.slug = p.cat_slug
on conflict (slug) where deleted_at is null do nothing;

-- ---------- Variants (100ml for all; 50ml for a few; prices in SLE minor) ----------
insert into public.product_variant (product_id, size_ml, concentration, sku, price_minor, compare_at_price_minor)
select pr.id, v.size_ml, 'EDP', pr.slug || '-' || v.size_ml || 'ml', v.price_minor, v.compare_minor
from (values
  ('asad',                     50,  38000, null),
  ('asad',                     100, 62000, 70000),
  ('yara',                     50,  34000, null),
  ('yara',                     100, 55000, null),
  ('khamrah',                  50,  42000, null),
  ('khamrah',                  100, 68000, null),
  ('badee-al-oud-amethyst',    100, 60000, null),
  ('fakhar-black',             100, 52000, null),
  ('club-de-nuit-intense-man', 105, 72000, 85000),
  ('tres-nuit',                100, 50000, null),
  ('kismet-angel',             50,  30000, null),
  ('kismet-angel',             100, 48000, null)
) as v(prod_slug, size_ml, price_minor, compare_minor)
join public.product pr on pr.slug = v.prod_slug
on conflict (sku) where deleted_at is null do nothing;

-- ---------- Scent-note links (top / heart / base) ----------
insert into public.product_scent_note (product_id, scent_note_id, position)
select pr.id, sn.id, l.position
from (values
  ('asad','Bergamot','top'), ('asad','Amber','heart'), ('asad','Oud','base'),
  ('yara','Pineapple','top'), ('yara','Jasmine','heart'), ('yara','Vanilla','base'),
  ('khamrah','Saffron','top'), ('khamrah','Amber','heart'), ('khamrah','Vanilla','base'),
  ('badee-al-oud-amethyst','Bergamot','top'), ('badee-al-oud-amethyst','Rose','heart'), ('badee-al-oud-amethyst','Oud','base'),
  ('fakhar-black','Bergamot','top'), ('fakhar-black','Musk','heart'), ('fakhar-black','Sandalwood','base'),
  ('club-de-nuit-intense-man','Pineapple','top'), ('club-de-nuit-intense-man','Jasmine','heart'), ('club-de-nuit-intense-man','Sandalwood','base'),
  ('tres-nuit','Bergamot','top'), ('tres-nuit','Jasmine','heart'), ('tres-nuit','Sandalwood','base'),
  ('kismet-angel','Saffron','top'), ('kismet-angel','Rose','heart'), ('kismet-angel','Vanilla','base')
) as l(prod_slug, note_name, position)
join public.product pr on pr.slug = l.prod_slug
join public.scent_note sn on sn.name = l.note_name
on conflict do nothing;

-- ---------- Seed stock through the ledger (25 units/variant), idempotent (audit H9) ----------
do $$
declare v record;
begin
  for v in select id from public.product_variant loop
    if not exists (select 1 from public.stock_ledger where variant_id = v.id and reason = 'seed') then
      perform public.fn_receive_stock(v.id, 25, null, 'seed');
    end if;
  end loop;
end $$;

-- ---------- Delivery zones (estimates only — guide, ADR-013) ----------
insert into public.delivery_zone (name, region_text, estimated_fee_minor, fee_estimate_text, eta_text, sort_order)
values
  ('Central Freetown', 'Central', 3000, 'Le 30–50 depending on distance', 'Same day', 1),
  ('West (Lumley/Aberdeen)', 'West', 5000, 'Le 50–80', '1–2 days', 2),
  ('East End', 'East', 4000, 'Le 40–70', '1–2 days', 3)
on conflict do nothing;

-- ---------- Loyalty config (owner-tunable; zeros until the owner sets economics) ----------
insert into public.loyalty_config (id, loyalty_enabled, promos_enabled, tiers_enabled,
                                   points_per_currency_unit, point_value_minor, points_expiry_days)
values (1, true, true, true, 0, 0, null)
on conflict (id) do nothing;

insert into public.loyalty_tier (name, cumulative_spend_threshold_minor, discount_percent, rank)
values ('Loyalty Card', 500000, 5.00, 1)
on conflict (name) do nothing;

insert into public.promo_rule (name, rule_type, threshold_minor, discount_type, discount_value, scope)
values ('Spend Le 1,000 get 10% off', 'order_spend_threshold_discount', 100000, 'percent', 10, 'all')
on conflict do nothing;

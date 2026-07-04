-- seed_catalog.sql — adds ~89 REAL fragrances alongside the existing 8 demo products.
-- Loaded by `supabase db push --include-seed` (registered in config.toml [db.seed]).
-- Idempotent: re-running is safe (on conflict do nothing; stock guarded by reason='seed').
-- Money is SLE minor units (Le 1.00 = 100). Names/notes are factual catalogue data.
-- No images are seeded here — the app shows a real-photo pool by character until you upload
-- your own bottle photography to Storage (see lib/productImage.ts).

-- ---------- Brands (real; existing 3 are no-ops) ----------
insert into public.brand (name, slug) values
  ('Lattafa', 'lattafa'),
  ('Armaf', 'armaf'),
  ('Maison Alhambra', 'maison-alhambra'),
  ('Al Haramain', 'al-haramain'),
  ('Rasasi', 'rasasi'),
  ('Afnan', 'afnan'),
  ('Swiss Arabian', 'swiss-arabian'),
  ('Paris Corner', 'paris-corner'),
  ('Ard Al Zaafaran', 'ard-al-zaafaran'),
  ('French Avenue', 'french-avenue')
on conflict (slug) where deleted_at is null do nothing;

-- ---------- Collections (categories) ----------
insert into public.category (name, slug, sort_order) values
  ('Summer', 'summer', 10),
  ('Date night', 'date-night', 11),
  ('Office', 'office', 12),
  ('Everyday', 'everyday', 13),
  ('Oud lovers', 'oud-lovers', 14),
  ('Gourmand & sweet', 'gourmand-sweet', 15),
  ('Fresh & aquatic', 'fresh-aquatic', 16),
  ('Signature', 'signature', 17)
on conflict (slug) where deleted_at is null do nothing;

-- ---------- Scent notes (expand the palette) ----------
insert into public.scent_note (name, note_family) values
  ('Lavender','aromatic'), ('Patchouli','woody'), ('Tuberose','floral'), ('Orange Blossom','floral'),
  ('Coffee','gourmand'), ('Cardamom','spicy'), ('Cinnamon','spicy'), ('Cedar','woody'),
  ('Pink Pepper','spicy'), ('Chocolate','gourmand'), ('White Musk','musky'), ('Apple','fruity'),
  ('Tobacco','oriental'), ('Lychee','fruity'), ('Raspberry','fruity'), ('Caramel','gourmand'),
  ('Honey','sweet'), ('Pear','fruity'), ('Whipped Cream','gourmand'), ('Grapefruit','citrus'),
  ('Ambergris','oriental'), ('Amberwood','woody'), ('Mandarin','citrus'), ('Ginger','spicy'),
  ('Geranium','floral'), ('Lemon','citrus'), ('Vetiver','woody'), ('Leather','leather'),
  ('Tonka Bean','sweet'), ('Plum','fruity'), ('Peach','fruity'), ('Iris','floral'), ('Incense','oriental')
on conflict (name) do nothing;

-- ---------- Products + scent-note links (one statement; no temp tables) ----------
with d(brand_slug, cat_slug, name, slug, descr, gender, t, h, b) as (
  values
    ('lattafa','date-night','Fakhar Lattafa','fakhar-lattafa-rose','Fruity rose with a warm sweet trail.','female','Saffron','Rose','Vanilla'),
    ('lattafa','signature','Asad Zanzibar','asad-zanzibar','Juicy pineapple over amber and patchouli.','male','Pineapple','Lavender','Patchouli'),
    ('lattafa','gourmand-sweet','Yara Moi','yara-moi','Creamy tuberose and orange blossom.','female','Tuberose','Orange Blossom','Vanilla'),
    ('lattafa','everyday','Yara Tous','yara-tous','Soft powdery florals on sandalwood.','female','Bergamot','Jasmine','Sandalwood'),
    ('lattafa','gourmand-sweet','Khamrah Qahwa','khamrah-qahwa','Spiced coffee, cardamom and vanilla.','unisex','Coffee','Cardamom','Vanilla'),
    ('lattafa','signature','Ana Abiyedh Rouge','ana-abiyedh-rouge','Hot cinnamon and saffron over amber.','unisex','Cinnamon','Saffron','Amber'),
    ('lattafa','oud-lovers','Raghba','raghba','Sweet vanilla sugar with oud and amber.','unisex','Vanilla','Amber','Oud'),
    ('lattafa','office','Ramz Lattafa Gold','ramz-lattafa-gold','Fresh bergamot and lavender on cedar.','male','Bergamot','Lavender','Cedar'),
    ('lattafa','everyday','Mayar','mayar','Pink pepper and jasmine with soft musk.','female','Pink Pepper','Jasmine','Musk'),
    ('lattafa','gourmand-sweet','Mayar Chocolate','mayar-chocolate','Rich chocolate and rose with vanilla.','female','Chocolate','Rose','Vanilla'),
    ('lattafa','oud-lovers','Oud Mood','oud-mood','Saffron and rose over deep oud.','unisex','Saffron','Rose','Oud'),
    ('lattafa','oud-lovers','Velvet Oud','velvet-oud','Warm cinnamon, oud and amber.','unisex','Cinnamon','Oud','Amber'),
    ('lattafa','office','His Confession','his-confession','Aromatic bergamot and lavender on sandalwood.','male','Bergamot','Lavender','Sandalwood'),
    ('lattafa','signature','Maahir','maahir','Green pineapple and rose with musk.','male','Pineapple','Rose','Musk'),
    ('lattafa','fresh-aquatic','Maahir Legacy','maahir-legacy','Crisp lemon and geranium on cedar.','male','Lemon','Geranium','Cedar'),
    ('lattafa','everyday','Opulent Musk','opulent-musk','Clean white musk with rose and amber.','unisex','White Musk','Rose','Amber'),
    ('lattafa','signature','Qaed Al Fursan','qaed-al-fursan','Apple and cinnamon over warm tobacco.','male','Apple','Cinnamon','Tobacco'),
    ('lattafa','signature','Qaed Al Fursan Unlimited','qaed-al-fursan-unlimited','Pineapple and cardamom on amber.','male','Pineapple','Cardamom','Amber'),
    ('lattafa','everyday','Najdia','najdia','Juicy lychee and rose with vanilla.','unisex','Lychee','Rose','Vanilla'),
    ('lattafa','gourmand-sweet','Ajwad','ajwad','Raspberry and tuberose with soft musk.','unisex','Raspberry','Tuberose','Musk'),
    ('lattafa','gourmand-sweet','Haya','haya','Apple and jasmine with caramel.','female','Apple','Jasmine','Caramel'),
    ('lattafa','gourmand-sweet','Nebras','nebras','Golden honey, amber and vanilla.','unisex','Honey','Amber','Vanilla'),
    ('lattafa','oud-lovers','Teriaq','teriaq','Spiced honey and cinnamon over oud.','unisex','Cinnamon','Honey','Oud'),
    ('lattafa','oud-lovers','Bade''e Al Oud Sublime','badee-al-oud-sublime','Saffron and rose over rich oud.','unisex','Saffron','Rose','Oud'),
    ('lattafa','office','Pride Al Nashama','pride-al-nashama','Bergamot and lavender with oud.','male','Bergamot','Lavender','Oud'),
    ('lattafa','gourmand-sweet','Fae','fae','Soft pear and jasmine with vanilla.','female','Pear','Jasmine','Vanilla'),
    ('lattafa','gourmand-sweet','Eclaire','eclaire','Whipped cream and pear with vanilla.','female','Whipped Cream','Pear','Vanilla'),
    ('lattafa','signature','Hayaati','hayaati','Apple and saffron over warm amber.','male','Apple','Saffron','Amber'),
    ('armaf','summer','Club de Nuit Sillage','club-de-nuit-sillage','Bright grapefruit and pineapple with ambergris.','unisex','Grapefruit','Pineapple','Ambergris'),
    ('armaf','signature','Club de Nuit Untold','club-de-nuit-untold','Saffron and amberwood with vanilla.','unisex','Saffron','Amberwood','Vanilla'),
    ('armaf','signature','Club de Nuit Urban Man Elixir','club-de-nuit-urban-man-elixir','Apple and cinnamon over tobacco.','male','Apple','Cinnamon','Tobacco'),
    ('armaf','everyday','Club de Nuit Woman','club-de-nuit-woman','Citrus and jasmine with vanilla.','female','Lemon','Jasmine','Vanilla'),
    ('armaf','office','Ventana','ventana','Fresh bergamot and lavender on cedar.','male','Bergamot','Lavender','Cedar'),
    ('armaf','signature','Derby Club House','derby-club-house','Apple and cinnamon over vetiver.','male','Apple','Cinnamon','Vetiver'),
    ('armaf','office','Hunter','hunter-armaf','Lemon and lavender on sandalwood.','male','Lemon','Lavender','Sandalwood'),
    ('armaf','gourmand-sweet','Le Parfait','le-parfait','Pineapple and tobacco with vanilla.','male','Pineapple','Tobacco','Vanilla'),
    ('armaf','summer','Odyssey Mandarin Sky','odyssey-mandarin-sky','Mandarin and ginger over amber.','unisex','Mandarin','Ginger','Amber'),
    ('armaf','oud-lovers','Odyssey Aoud','odyssey-aoud','Saffron and oud with patchouli.','unisex','Saffron','Oud','Patchouli'),
    ('armaf','signature','Bucephalus XI','bucephalus-xi','Apple and cinnamon over amber.','male','Apple','Cinnamon','Amber'),
    ('armaf','office','Tag Him','tag-him','Fresh bergamot and geranium with musk.','male','Bergamot','Geranium','Musk'),
    ('maison-alhambra','date-night','Barakkat Rouge 540','barakkat-rouge-540','Saffron and jasmine over amberwood.','unisex','Saffron','Jasmine','Amberwood'),
    ('maison-alhambra','oud-lovers','Barakkat Satin Oud','barakkat-satin-oud','Saffron and rose over oud.','unisex','Saffron','Rose','Oud'),
    ('maison-alhambra','gourmand-sweet','Jean Lowe Immortal','jean-lowe-immortal','Pineapple and cinnamon with vanilla.','male','Pineapple','Cinnamon','Vanilla'),
    ('maison-alhambra','everyday','Le De Blanc','le-de-blanc','Bergamot and jasmine with clean musk.','unisex','Bergamot','Jasmine','Musk'),
    ('maison-alhambra','office','Salvo','salvo','Fresh bergamot and lavender on amber.','male','Bergamot','Lavender','Amber'),
    ('maison-alhambra','signature','Raved','raved','Apple and cardamom over tonka bean.','male','Apple','Cardamom','Tonka Bean'),
    ('maison-alhambra','office','The Tux','the-tux','Lemon and lavender on patchouli.','male','Lemon','Lavender','Patchouli'),
    ('maison-alhambra','signature','Olympic Man','olympic-man','Bergamot and cinnamon over leather.','male','Bergamot','Cinnamon','Leather'),
    ('maison-alhambra','signature','Versatile Cardinal','versatile-cardinal','Pineapple and jasmine on sandalwood.','male','Pineapple','Jasmine','Sandalwood'),
    ('maison-alhambra','fresh-aquatic','Philos Aexclusif','philos-aexclusif','Grapefruit and lavender with amberwood.','male','Grapefruit','Lavender','Amberwood'),
    ('al-haramain','everyday','Amber Oud Gold Edition','amber-oud-gold-edition','Citrus and amber with clean musk.','unisex','Lemon','Amber','Musk'),
    ('al-haramain','gourmand-sweet','Amber Oud Rouge Edition','amber-oud-rouge-edition','Raspberry and amber with vanilla.','unisex','Raspberry','Amber','Vanilla'),
    ('al-haramain','signature','Amber Oud Carbon Edition','amber-oud-carbon-edition','Apple and cinnamon over amber.','unisex','Apple','Cinnamon','Amber'),
    ('al-haramain','office','L''Aventure','laventure','Cardamom and geranium over amber.','male','Cardamom','Geranium','Amber'),
    ('al-haramain','signature','L''Aventure Knight','laventure-knight','Apple and cinnamon with leather.','male','Apple','Cinnamon','Leather'),
    ('al-haramain','everyday','Junoon','junoon','Pear and jasmine with soft musk.','female','Pear','Jasmine','Musk'),
    ('al-haramain','oud-lovers','Manificent','manificent','Saffron and rose over oud.','unisex','Saffron','Rose','Oud'),
    ('al-haramain','everyday','Musk Tahara','musk-tahara','Clean white musk with rose and amber.','unisex','White Musk','Rose','Amber'),
    ('rasasi','signature','Hawas for Him','hawas-for-him','Apple and cardamom with ambergris.','male','Apple','Cardamom','Ambergris'),
    ('rasasi','summer','Hawas Ice','hawas-ice','Cool bergamot and cinnamon with musk.','male','Bergamot','Cinnamon','Musk'),
    ('rasasi','date-night','Hawas for Her','hawas-for-her','Lychee and jasmine with vanilla.','female','Lychee','Jasmine','Vanilla'),
    ('rasasi','oud-lovers','Daarej','daarej','Cinnamon and rose over amber.','unisex','Cinnamon','Rose','Amber'),
    ('rasasi','oud-lovers','La Yuqawam','la-yuqawam','Tobacco and oud with amber.','male','Tobacco','Oud','Amber'),
    ('rasasi','signature','Shuhrah','shuhrah','Bergamot and leather with patchouli.','male','Bergamot','Leather','Patchouli'),
    ('rasasi','office','Royale Blue','royale-blue','Lemon and lavender on cedar.','male','Lemon','Lavender','Cedar'),
    ('afnan','signature','9 PM','9pm','Apple and cinnamon with vanilla.','male','Apple','Cinnamon','Vanilla'),
    ('afnan','office','9 AM','9am','Bergamot and lavender on amberwood.','male','Bergamot','Lavender','Amberwood'),
    ('afnan','date-night','9 PM Femme','9pm-femme','Raspberry and jasmine with vanilla.','female','Raspberry','Jasmine','Vanilla'),
    ('afnan','signature','Supremacy Not Only Intense','supremacy-not-only-intense','Apple and cinnamon over amber.','male','Apple','Cinnamon','Amber'),
    ('afnan','office','Supremacy Silver','supremacy-silver','Fresh bergamot and lavender on cedar.','male','Bergamot','Lavender','Cedar'),
    ('afnan','fresh-aquatic','Turathi Blue','turathi-blue','Pineapple and saffron with ambergris.','unisex','Pineapple','Saffron','Ambergris'),
    ('afnan','signature','Rare Carbon','rare-carbon','Pineapple and cinnamon over tobacco.','male','Pineapple','Cinnamon','Tobacco'),
    ('afnan','date-night','482 Avant Garde','482-avant-garde','Saffron and amberwood with vanilla.','unisex','Saffron','Amberwood','Vanilla'),
    ('afnan','gourmand-sweet','Zimaya Francesca','zimaya-francesca','Peach and jasmine with soft musk.','female','Peach','Jasmine','Musk'),
    ('swiss-arabian','oud-lovers','Shaghaf Oud','shaghaf-oud','Saffron and rose over oud.','unisex','Saffron','Rose','Oud'),
    ('swiss-arabian','date-night','Layali','layali','Plum and jasmine with vanilla.','female','Plum','Jasmine','Vanilla'),
    ('swiss-arabian','everyday','Musk Malaki','musk-malaki','Honey and amber with soft musk.','unisex','Honey','Amber','Musk'),
    ('swiss-arabian','office','Casablanca','casablanca-sa','Lavender and geranium on sandalwood.','male','Lavender','Geranium','Sandalwood'),
    ('swiss-arabian','summer','Edge','edge-sa','Lemon and cardamom over amber.','male','Lemon','Cardamom','Amber'),
    ('swiss-arabian','oud-lovers','Mukhallat Malaki','mukhallat-malaki','Rich oud and rose with amber.','unisex','Oud','Rose','Amber'),
    ('paris-corner','signature','Emir Ageratum','emir-ageratum','Pineapple and cinnamon over amber.','male','Pineapple','Cinnamon','Amber'),
    ('paris-corner','date-night','Emir Iris Harlww','emir-iris-harlww','Powdery iris and rose with vanilla.','female','Iris','Rose','Vanilla'),
    ('paris-corner','gourmand-sweet','Emir Laverne Immortal','emir-laverne-immortal','Apple and cinnamon with vanilla.','male','Apple','Cinnamon','Vanilla'),
    ('paris-corner','date-night','Emir Bota''fok','emir-botafok','Saffron and jasmine over amberwood.','unisex','Saffron','Jasmine','Amberwood'),
    ('ard-al-zaafaran','signature','Jazzab Gold','jazzab-gold','Apple and cinnamon over amber.','male','Apple','Cinnamon','Amber'),
    ('ard-al-zaafaran','date-night','Romancea','romancea','Peach and rose with soft musk.','female','Peach','Rose','Musk'),
    ('ard-al-zaafaran','oud-lovers','Dukhan','dukhan','Smoky incense and oud with amber.','unisex','Incense','Oud','Amber'),
    ('french-avenue','gourmand-sweet','Liquid Brun','liquid-brun','Caramel and tobacco with vanilla.','male','Caramel','Tobacco','Vanilla'),
    ('french-avenue','oud-lovers','Oud Experience','oud-experience','Saffron and rose over deep oud.','unisex','Saffron','Rose','Oud')
),
ins_products as (
  insert into public.product (brand_id, category_id, name, slug, description, gender, is_featured, popularity_score, avg_rating, review_count)
  select b.id, c.id, d.name, d.slug, d.descr, d.gender,
    (abs(hashtext(d.slug)) % 11 = 0),
    (abs(hashtext(d.slug)) % 1000),
    round((3.8 + (abs(hashtext(d.slug)) % 13) / 10.0)::numeric, 1),
    (abs(hashtext(d.slug)) % 850) + 6
  from d
  join public.brand b on b.slug = d.brand_slug
  join public.category c on c.slug = d.cat_slug
  on conflict (slug) where deleted_at is null do nothing
  returning id, slug
)
insert into public.product_scent_note (product_id, scent_note_id, position)
select ip.id, sn.id, x.position
from d
join ins_products ip on ip.slug = d.slug
cross join lateral (values ('top', d.t), ('heart', d.h), ('base', d.b)) as x(position, note)
join public.scent_note sn on sn.name = x.note
on conflict do nothing;

-- ---------- Variants: 100ml EDP for every product without one; ~1 in 6 on sale ----------
insert into public.product_variant (product_id, size_ml, concentration, sku, price_minor, compare_at_price_minor)
select pr.id, 100, 'EDP', pr.slug || '-100ml',
  30000 + (abs(hashtext(pr.slug)) % 50) * 1000,
  case when abs(hashtext(pr.slug)) % 6 = 0
       then (30000 + (abs(hashtext(pr.slug)) % 50) * 1000) + 13000 else null end
from public.product pr
where not exists (select 1 from public.product_variant v where v.product_id = pr.id)
on conflict (sku) where deleted_at is null do nothing;

-- ---------- Variants: a 50ml sibling for roughly half ----------
insert into public.product_variant (product_id, size_ml, concentration, sku, price_minor)
select pr.id, 50, 'EDP', pr.slug || '-50ml',
  round((30000 + (abs(hashtext(pr.slug)) % 50) * 1000) * 0.62)
from public.product pr
where abs(hashtext(pr.slug)) % 2 = 0
  and exists (select 1 from public.product_variant v where v.product_id = pr.id and v.size_ml = 100)
  and not exists (select 1 from public.product_variant v where v.product_id = pr.id and v.size_ml = 50)
on conflict (sku) where deleted_at is null do nothing;

-- ---------- Stock through the ledger (25 units/variant), idempotent ----------
do $$
declare v record;
begin
  for v in select id from public.product_variant loop
    if not exists (select 1 from public.stock_ledger where variant_id = v.id and reason = 'seed') then
      perform public.fn_receive_stock(v.id, 25, null, 'seed');
    end if;
  end loop;
end $$;

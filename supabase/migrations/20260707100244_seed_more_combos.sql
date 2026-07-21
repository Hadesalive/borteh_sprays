-- Seed a few more demo combos so the "Perfect pairs" rail / all-pairs screen has
-- variety (one lone pair looked sparse). Dynamic (no hard-coded ids), idempotent
-- (only runs while there are fewer than 4 combos, and skips a slug that exists),
-- and it pairs DISTINCT in-stock products not already used by another combo — so
-- it never re-pairs the same bottles as the 3a "Signature Pair". Each new pair is
-- priced at 90% of its sum, a real deal so the strike-through price shows.
do $$
declare
  v_arr    uuid[];
  v_names  text[];
  v_prices bigint[];
  i        int := 1;
  v_made   int := 0;
  v_combo  uuid;
  v_sum    bigint;
  v_slug   text;
begin
  if (select count(*) from public.combo where deleted_at is null) >= 4 then return; end if;

  with cheapest as (
    select distinct on (p.id)
      pv.id as variant_id, p.name as pname, pv.price_minor as price,
      p.popularity_score as pop, p.id as pid
    from public.product p
    join public.product_variant pv
      on pv.product_id = p.id and pv.is_active and pv.deleted_at is null
    join public.availability_signal a
      on a.variant_id = pv.id and a.band <> 'out'
    where p.is_active and p.deleted_at is null
      and not exists (select 1 from public.combo_item ci where ci.variant_id = pv.id)
    order by p.id, pv.price_minor asc
  )
  select array_agg(variant_id order by pop desc, pid),
         array_agg(pname      order by pop desc, pid),
         array_agg(price      order by pop desc, pid)
    into v_arr, v_names, v_prices
  from cheapest;

  if v_arr is null then return; end if;

  -- pair consecutive products; make at most 3 new combos
  while i + 1 <= array_length(v_arr, 1) and v_made < 3 loop
    v_slug := 'curated-pair-' || (v_made + 2);  -- signature-pair is #1
    if not exists (select 1 from public.combo where slug = v_slug and deleted_at is null) then
      v_sum := v_prices[i] + v_prices[i + 1];
      insert into public.combo (name, slug, description, combo_price_minor)
      values (v_names[i] || ' & ' || v_names[i + 1],
              v_slug,
              'A curated pairing — two scents made to layer, day into night.',
              round(v_sum * 0.9)::bigint)
      returning id into v_combo;

      insert into public.combo_item (combo_id, variant_id, qty, sort_order)
      values (v_combo, v_arr[i], 1, 0),
             (v_combo, v_arr[i + 1], 1, 1);
      v_made := v_made + 1;
    end if;
    i := i + 2;
  end loop;
end $$;

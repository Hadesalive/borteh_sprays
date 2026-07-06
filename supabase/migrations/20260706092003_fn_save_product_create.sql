-- 20260706092003_fn_save_product_create.sql
-- Extend fn_save_product (originally 20260706092001) to also CREATE a product when the payload
-- carries no id. Same one-transaction guarantees; on create the product INSERT fires the embed
-- INSERT trigger (trg_product_embed_ins) so a new product is embedded from day one. Update path
-- is unchanged. service_role-only.
--
-- On create: name + brand_id + scent_family are required; a unique slug is derived from the name
-- (suffixed if it collides with a live product). Variants/notes flow through the shared blocks.

create or replace function public.fn_save_product(payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id       uuid    := nullif(payload->>'id', '')::uuid;
  v_family   text    := nullif(btrim(payload->>'scent_family'), '');
  v_name     text    := nullif(btrim(payload->>'name'), '');
  v_brand    uuid    := nullif(payload->>'brand_id', '')::uuid;
  v_creating boolean := (v_id is null);
  v_slug     text;
  v_note     jsonb;
  v_variant  jsonb;
  v_note_id  uuid;
begin
  if v_family is null then
    raise exception 'fn_save_product: scent_family is required (recs gate)';
  end if;

  if v_creating then
    -- ---- CREATE ----
    if v_name is null  then raise exception 'fn_save_product: name is required'; end if;
    if v_brand is null then raise exception 'fn_save_product: brand is required'; end if;
    v_id := gen_random_uuid();

    v_slug := btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-');
    if coalesce(v_slug, '') = '' then
      v_slug := left(replace(v_id::text, '-', ''), 10);
    end if;
    if exists (select 1 from public.product where slug = v_slug and deleted_at is null) then
      v_slug := v_slug || '-' || left(replace(v_id::text, '-', ''), 6);
    end if;

    insert into public.product (id, brand_id, category_id, name, slug, description, gender,
        scent_family, main_accords, release_year, is_active, is_featured)
    values (
      v_id, v_brand,
      nullif(payload->>'category_id', '')::uuid,
      v_name, v_slug,
      nullif(btrim(payload->>'description'), ''),
      coalesce(nullif(payload->>'gender', ''), 'unisex'),
      v_family,
      (select array_agg(btrim(x)) from jsonb_array_elements_text(coalesce(payload->'main_accords', '[]'::jsonb)) as x where btrim(x) <> ''),
      nullif(payload->>'release_year', '')::int,
      coalesce(nullif(payload->>'is_active', '')::boolean, true),
      coalesce(nullif(payload->>'is_featured', '')::boolean, false)
    );
    -- trg_product_embed_ins fires here → embed the new product.
  else
    -- ---- UPDATE ---- (plain UPDATE → trg_product_embed_upd fires on content change)
    if not exists (select 1 from public.product where id = v_id) then
      raise exception 'fn_save_product: product % not found', v_id;
    end if;
    update public.product set
      name         = coalesce(v_name, name),
      brand_id     = coalesce(v_brand, brand_id),
      category_id  = case when payload ? 'category_id' then nullif(payload->>'category_id', '')::uuid else category_id end,
      gender       = coalesce(nullif(payload->>'gender', ''), gender),
      description  = case when payload ? 'description' then nullif(btrim(payload->>'description'), '') else description end,
      scent_family = v_family,
      main_accords = case when payload ? 'main_accords'
                          then (select array_agg(btrim(x)) from jsonb_array_elements_text(payload->'main_accords') as x where btrim(x) <> '')
                          else main_accords end,
      release_year = case when payload ? 'release_year' then nullif(payload->>'release_year', '')::int else release_year end,
      is_active    = coalesce(nullif(payload->>'is_active', '')::boolean, is_active),
      is_featured  = coalesce(nullif(payload->>'is_featured', '')::boolean, is_featured),
      updated_at   = now()
    where id = v_id;
  end if;

  -- ---- SHARED: replace scent notes (resolve/create scent_note by name) ----
  if payload ? 'notes' then
    delete from public.product_scent_note where product_id = v_id;
    for v_note in select * from jsonb_array_elements(coalesce(payload->'notes', '[]'::jsonb)) loop
      if nullif(btrim(v_note->>'name'), '') is null then continue; end if;
      if coalesce(v_note->>'position', '') not in ('top', 'heart', 'base') then continue; end if;
      insert into public.scent_note (name) values (btrim(v_note->>'name'))
        on conflict (name) do update set name = excluded.name
        returning id into v_note_id;
      insert into public.product_scent_note (product_id, scent_note_id, position)
        values (v_id, v_note_id, v_note->>'position')
        on conflict do nothing;
    end loop;
  end if;

  -- ---- SHARED: upsert variants (never delete — protects inventory + ledger history) ----
  if payload ? 'variants' then
    for v_variant in select * from jsonb_array_elements(coalesce(payload->'variants', '[]'::jsonb)) loop
      if nullif(v_variant->>'id', '') is not null then
        update public.product_variant set
          size_ml                = coalesce(nullif(v_variant->>'size_ml', '')::int, size_ml),
          concentration          = coalesce(nullif(v_variant->>'concentration', ''), concentration),
          sku                    = coalesce(nullif(btrim(v_variant->>'sku'), ''), sku),
          barcode                = case when v_variant ? 'barcode' then nullif(btrim(v_variant->>'barcode'), '') else barcode end,
          price_minor            = coalesce(nullif(v_variant->>'price_minor', '')::bigint, price_minor),
          compare_at_price_minor = case when v_variant ? 'compare_at_price_minor'
                                        then nullif(v_variant->>'compare_at_price_minor', '')::bigint
                                        else compare_at_price_minor end,
          is_active              = coalesce(nullif(v_variant->>'is_active', '')::boolean, is_active),
          updated_at             = now()
        where id = (v_variant->>'id')::uuid and product_id = v_id;
      else
        insert into public.product_variant
          (product_id, size_ml, concentration, sku, barcode, price_minor, compare_at_price_minor, is_active)
        values (
          v_id,
          (v_variant->>'size_ml')::int,
          v_variant->>'concentration',
          btrim(v_variant->>'sku'),
          nullif(btrim(v_variant->>'barcode'), ''),
          (v_variant->>'price_minor')::bigint,
          nullif(v_variant->>'compare_at_price_minor', '')::bigint,
          coalesce(nullif(v_variant->>'is_active', '')::boolean, true)
        );
      end if;
    end loop;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.fn_save_product(jsonb) from public, anon, authenticated;
grant  execute on function public.fn_save_product(jsonb) to service_role;

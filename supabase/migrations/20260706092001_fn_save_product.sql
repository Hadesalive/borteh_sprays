-- 20260706092001_fn_save_product.sql
-- fn_save_product: save a product's scent profile + variants atomically, in one transaction,
-- so the admin editor never leaves a product half-written. The product write is a PLAIN UPDATE
-- so trg_product_embed_upd (20260706090023) fires on any content change and GitHub re-embeds.
-- service_role-only (called from the admin's service-role client).
--
-- Payload contract (jsonb):
--   { id, name, brand_id, category_id, gender, description, scent_family, main_accords[],
--     release_year, is_active, is_featured,
--     notes:    [ { name, position:'top'|'heart'|'base' }, ... ],
--     variants: [ { id?, size_ml, concentration, sku, barcode, price_minor,
--                   compare_at_price_minor, is_active }, ... ] }
--
-- Invariants preserved:
--   • scent_family is REQUIRED (the Phase-0 recs gate) — raises if blank.
--   • Product content edits go through a plain UPDATE → embed trigger fires (name / scent_family /
--     description / main_accords / brand_id / is_active are the trigger's watched columns).
--   • Variants are UPSERTED, never deleted — deleting a variant would cascade its inventory_item,
--     stock_ledger history, and availability_signal. Deactivate via is_active instead.
--
-- Known limitation (documented, not a bug): the embed trigger watches product-table columns only,
-- so a notes-only or concentration-only edit does not by itself re-embed. Scent-profile saves
-- almost always also touch name/family/description/accords, which do fire it.

create or replace function public.fn_save_product(payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id     uuid := nullif(payload->>'id', '')::uuid;
  v_family text := nullif(btrim(payload->>'scent_family'), '');
  v_note    jsonb;
  v_variant jsonb;
  v_note_id uuid;
begin
  if v_id is null then raise exception 'fn_save_product: product id is required'; end if;
  if not exists (select 1 from public.product where id = v_id) then
    raise exception 'fn_save_product: product % not found', v_id;
  end if;
  if v_family is null then
    raise exception 'fn_save_product: scent_family is required (recs gate)';
  end if;

  -- 1) Plain product UPDATE → fires the embed dispatch trigger on any content change.
  update public.product set
    name         = coalesce(nullif(btrim(payload->>'name'), ''), name),
    brand_id     = coalesce(nullif(payload->>'brand_id', '')::uuid, brand_id),
    category_id  = case when payload ? 'category_id'
                        then nullif(payload->>'category_id', '')::uuid else category_id end,
    gender       = coalesce(nullif(payload->>'gender', ''), gender),
    description  = case when payload ? 'description'
                        then nullif(btrim(payload->>'description'), '') else description end,
    scent_family = v_family,
    main_accords = case when payload ? 'main_accords'
                        then (select array_agg(btrim(x))
                                from jsonb_array_elements_text(payload->'main_accords') as x
                               where btrim(x) <> '')
                        else main_accords end,
    release_year = case when payload ? 'release_year'
                        then nullif(payload->>'release_year', '')::int else release_year end,
    is_active    = coalesce(nullif(payload->>'is_active', '')::boolean, is_active),
    is_featured  = coalesce(nullif(payload->>'is_featured', '')::boolean, is_featured),
    updated_at   = now()
  where id = v_id;

  -- 2) Replace scent notes: clear, then re-insert, resolving/creating scent_note by name.
  if payload ? 'notes' then
    delete from public.product_scent_note where product_id = v_id;
    for v_note in select * from jsonb_array_elements(coalesce(payload->'notes', '[]'::jsonb)) loop
      if nullif(btrim(v_note->>'name'), '') is null then continue; end if;
      if coalesce(v_note->>'position','') not in ('top','heart','base') then continue; end if;
      insert into public.scent_note (name) values (btrim(v_note->>'name'))
        on conflict (name) do update set name = excluded.name
        returning id into v_note_id;
      insert into public.product_scent_note (product_id, scent_note_id, position)
        values (v_id, v_note_id, v_note->>'position')
        on conflict do nothing;
    end loop;
  end if;

  -- 3) Upsert variants (never delete — protects inventory + ledger history).
  if payload ? 'variants' then
    for v_variant in select * from jsonb_array_elements(coalesce(payload->'variants', '[]'::jsonb)) loop
      if nullif(v_variant->>'id', '') is not null then
        update public.product_variant set
          size_ml                = coalesce(nullif(v_variant->>'size_ml', '')::int, size_ml),
          concentration          = coalesce(nullif(v_variant->>'concentration', ''), concentration),
          sku                    = coalesce(nullif(btrim(v_variant->>'sku'), ''), sku),
          barcode                = case when v_variant ? 'barcode'
                                        then nullif(btrim(v_variant->>'barcode'), '') else barcode end,
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

-- 20260706092000_fn_stocktake.sql
-- fn_stocktake: set a variant's on-hand to an absolute counted number (physical count),
-- the one stock write the admin lacked. Mirrors the existing mutators in
-- 20260616090003_functions_triggers.sql: lock the row (FOR UPDATE), write the two-dimension
-- stock_ledger, refresh the availability band via fn_recompute_band. service_role-only.
--
-- Notes:
--   • The movement is recorded as an 'adjustment' (the ledger CHECK has no 'stocktake' type);
--     reason defaults to 'Stocktake' so it is distinguishable in the audit trail.
--   • A no-op count (delta = 0) returns early: stock_ledger.ck_ledger_nonzero rejects a zero row,
--     and there is genuinely nothing to record.
--   • Counting below what is currently reserved would violate inventory_item.ck_reserved_le_onhand,
--     so it raises with a clear message instead of a raw constraint error.

create or replace function public.fn_stocktake(p_variant uuid, p_count int, p_actor uuid default null, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_on int; v_res int; v_delta int;
begin
  if p_count < 0 then raise exception 'stocktake count must be >= 0'; end if;
  select qty_on_hand, qty_reserved into v_on, v_res
    from public.inventory_item where variant_id = p_variant for update;
  if not found then raise exception 'inventory_item missing for variant %', p_variant; end if;
  if p_count < v_res then
    raise exception 'cannot count % units; % are reserved (variant %)', p_count, v_res, p_variant;
  end if;
  v_delta := p_count - v_on;
  if v_delta = 0 then return; end if;            -- nothing moved; a zero ledger row is invalid
  update public.inventory_item set qty_on_hand = p_count, updated_at = now()
   where variant_id = p_variant returning qty_on_hand, qty_reserved into v_on, v_res;
  insert into public.stock_ledger(variant_id, movement_type, qty_delta, qty_reserved_delta,
      balance_after, reserved_after, reference_type, reference_id, reason, created_by)
    values (p_variant, 'adjustment', v_delta, 0, v_on, v_res, 'manual', null,
            coalesce(nullif(btrim(p_reason), ''), 'Stocktake'), p_actor);
  perform public.fn_recompute_band(p_variant);
end;
$$;

-- Same lockdown as the other inventory mutators: service-role only.
revoke execute on function public.fn_stocktake(uuid,int,uuid,text) from public, anon, authenticated;
grant  execute on function public.fn_stocktake(uuid,int,uuid,text) to service_role;

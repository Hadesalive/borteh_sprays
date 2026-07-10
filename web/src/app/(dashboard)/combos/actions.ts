"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

export type ComboItemInput = { variantId: string; qty: number };
export type ComboInput = {
  name: string;
  slug: string;
  description: string;
  active: boolean;
  items: ComboItemInput[];
  /** Deal price in minor units. null = no deal (charge the honest sum). */
  dealPriceMinor: number | null;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

function cleanItems(items: ComboItemInput[]) {
  return items.filter((i) => i.variantId && i.qty > 0);
}

function validate(input: ComboInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  if (!input.slug.trim()) return "Slug is required.";
  const items = cleanItems(input.items);
  if (items.length < 2) return "A combo needs at least two fragrances.";
  if (new Set(items.map((i) => i.variantId)).size !== items.length) return "Each fragrance can only be added once.";
  if (input.dealPriceMinor != null && input.dealPriceMinor <= 0) return "Deal price must be greater than zero, or left blank.";
  return null;
}

function itemRows(comboId: string, items: ComboItemInput[]) {
  return cleanItems(items).map((i, idx) => ({ combo_id: comboId, variant_id: i.variantId, qty: i.qty, sort_order: idx }));
}

export async function createCombo(input: ComboInput): Promise<ActionResult> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  const db = createAdminClient();
  const { data, error } = await db
    .from("combo")
    .insert({ name: input.name.trim(), slug: input.slug.trim(), description: input.description.trim() || null, is_active: input.active, combo_price_minor: input.dealPriceMinor })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the combo." };
  const { error: e2 } = await db.from("combo_item").insert(itemRows(data.id as string, input.items));
  if (e2) return { ok: false, error: e2.message };
  revalidatePath("/combos");
  return { ok: true };
}

export async function updateCombo(id: string, input: ComboInput): Promise<ActionResult> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  const db = createAdminClient();
  const { error } = await db
    .from("combo")
    .update({ name: input.name.trim(), slug: input.slug.trim(), description: input.description.trim() || null, is_active: input.active, combo_price_minor: input.dealPriceMinor })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  // Replace the item set (simplest correct edit — the pair is small).
  const { error: eDel } = await db.from("combo_item").delete().eq("combo_id", id);
  if (eDel) return { ok: false, error: eDel.message };
  const { error: e2 } = await db.from("combo_item").insert(itemRows(id, input.items));
  if (e2) return { ok: false, error: e2.message };
  revalidatePath("/combos");
  return { ok: true };
}

export async function setComboActive(id: string, active: boolean): Promise<ActionResult> {
  const { error } = await createAdminClient().from("combo").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/combos");
  return { ok: true };
}

/** Soft delete — frees the slug (uq index is WHERE deleted_at is null). */
export async function deleteCombo(id: string): Promise<ActionResult> {
  const { error } = await createAdminClient()
    .from("combo")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/combos");
  return { ok: true };
}

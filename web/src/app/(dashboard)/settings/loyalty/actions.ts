"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setLoyaltyFlag(
  id: number,
  field: "loyalty_enabled" | "promos_enabled" | "tiers_enabled",
  value: boolean,
): Promise<ActionResult> {
  const { error } = await createAdminClient()
    .from("loyalty_config")
    .update({ [field]: value })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/loyalty");
  return { ok: true };
}

export async function updateLoyaltyRates(
  id: number,
  input: { pointsPerUnit: number; pointValueLe: number; expiryDays: number },
): Promise<ActionResult> {
  const { pointsPerUnit, pointValueLe, expiryDays } = input;
  if (![pointsPerUnit, pointValueLe, expiryDays].every((n) => Number.isFinite(n) && n >= 0)) {
    return { ok: false, error: "Enter non-negative numbers." };
  }
  const { error } = await createAdminClient()
    .from("loyalty_config")
    .update({
      points_per_currency_unit: pointsPerUnit,
      point_value_minor: Math.round(pointValueLe * 100),
      points_expiry_days: Math.round(expiryDays),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/loyalty");
  return { ok: true };
}

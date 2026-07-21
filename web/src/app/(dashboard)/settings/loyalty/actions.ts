"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/supabase/auth-server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setLoyaltyFlag(
  id: number,
  field: "loyalty_enabled" | "promos_enabled" | "tiers_enabled",
  value: boolean,
): Promise<ActionResult> {
  await requireStaff();
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
  input: { pointsPerUnit: number; pointValueLe: number; expiryDays: number; referralPoints: number },
): Promise<ActionResult> {
  await requireStaff();
  const { pointsPerUnit, pointValueLe, expiryDays, referralPoints } = input;
  if (![pointsPerUnit, pointValueLe, expiryDays, referralPoints].every((n) => Number.isFinite(n) && n >= 0)) {
    return { ok: false, error: "Enter non-negative numbers." };
  }
  const { error } = await createAdminClient()
    .from("loyalty_config")
    .update({
      points_per_currency_unit: pointsPerUnit,
      point_value_minor: Math.round(pointValueLe * 100),
      points_expiry_days: Math.round(expiryDays),
      referral_points: Math.round(referralPoints),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/loyalty");
  return { ok: true };
}

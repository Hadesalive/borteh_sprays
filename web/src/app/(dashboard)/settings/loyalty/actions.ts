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

export type TierInput = { name: string; thresholdLe: number; discountPercent: number; isActive: boolean };

/** Shared validation — the same rules the table's own CHECK constraints enforce,
 *  surfaced as plain English instead of a Postgres error. */
function validateTier(input: TierInput): string | null {
  if (!input.name.trim()) return "Give the tier a name.";
  if (!Number.isFinite(input.thresholdLe) || input.thresholdLe < 0) return "Spend threshold must be zero or more.";
  if (!Number.isFinite(input.discountPercent) || input.discountPercent < 0 || input.discountPercent > 100) {
    return "Discount must be between 0 and 100%.";
  }
  return null;
}

export async function createTier(input: TierInput): Promise<ActionResult> {
  await requireStaff();
  const invalid = validateTier(input);
  if (invalid) return { ok: false, error: invalid };

  const db = createAdminClient();
  // Rank orders the ladder; put a new tier at the end and let the threshold do
  // the real work (the checkout picks the highest discount the customer clears).
  const { data: last, error: rankError } = await db
    .from("loyalty_tier")
    .select("rank")
    .order("rank", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rankError) return { ok: false, error: rankError.message };

  const { error } = await db.from("loyalty_tier").insert({
    name: input.name.trim(),
    cumulative_spend_threshold_minor: Math.round(input.thresholdLe * 100),
    discount_percent: input.discountPercent,
    is_active: input.isActive,
    rank: ((last?.rank as number | undefined) ?? 0) + 1,
  });
  if (error) {
    return { ok: false, error: /duplicate key/.test(error.message) ? "A tier with that name already exists." : error.message };
  }
  revalidatePath("/settings/loyalty");
  return { ok: true };
}

export async function updateTier(id: string, input: TierInput): Promise<ActionResult> {
  await requireStaff();
  const invalid = validateTier(input);
  if (invalid) return { ok: false, error: invalid };

  const { error } = await createAdminClient()
    .from("loyalty_tier")
    .update({
      name: input.name.trim(),
      cumulative_spend_threshold_minor: Math.round(input.thresholdLe * 100),
      discount_percent: input.discountPercent,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    return { ok: false, error: /duplicate key/.test(error.message) ? "A tier with that name already exists." : error.message };
  }
  revalidatePath("/settings/loyalty");
  return { ok: true };
}

/** Remove a tier outright. Safe: loyalty_account.current_tier_id is ON DELETE
 *  SET NULL, so a member pinned to it simply loses the pin and is re-evaluated
 *  against the remaining tiers by lifetime spend. */
export async function deleteTier(id: string): Promise<ActionResult> {
  await requireStaff();
  const { error } = await createAdminClient().from("loyalty_tier").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/loyalty");
  return { ok: true };
}

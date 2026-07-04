"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CouponResult = { ok: true; code: string } | { ok: false; error: string };

function revalidate(userId: string) {
  revalidatePath("/customers");
  revalidatePath(`/customers/${userId}`);
}

export async function setCustomerBlocked(id: string, blocked: boolean): Promise<ActionResult> {
  const { error } = await createAdminClient().from("app_user").update({ is_blocked: blocked }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate(id);
  return { ok: true };
}

/** Add (or deduct, with negative delta) loyalty points, recording a ledger entry. */
export async function grantPoints(userId: string, delta: number, reason: string): Promise<ActionResult> {
  if (!Number.isInteger(delta) || delta === 0) return { ok: false, error: "Enter a non-zero whole number of points." };
  const db = createAdminClient();

  const { data: acct } = await db
    .from("loyalty_account")
    .select("id, points_balance, lifetime_points")
    .eq("user_id", userId)
    .maybeSingle();

  let accountId: string;
  let newBalance: number;

  if (acct) {
    newBalance = (acct.points_balance ?? 0) + delta;
    if (newBalance < 0) return { ok: false, error: "Balance can't go below zero." };
    accountId = acct.id as string;
    const { error } = await db
      .from("loyalty_account")
      .update({ points_balance: newBalance, lifetime_points: (acct.lifetime_points ?? 0) + Math.max(delta, 0) })
      .eq("id", accountId);
    if (error) return { ok: false, error: error.message };
  } else {
    if (delta < 0) return { ok: false, error: "Customer has no points yet." };
    newBalance = delta;
    const { data: created, error } = await db
      .from("loyalty_account")
      .insert({ user_id: userId, points_balance: delta, lifetime_points: delta })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: error?.message ?? "Could not create loyalty account." };
    accountId = created.id as string;
  }

  const { error: ledgerErr } = await db.from("loyalty_ledger").insert({
    account_id: accountId,
    user_id: userId,
    delta,
    type: "adjustment",
    balance_after: newBalance,
    reason: reason.trim() || "Manual adjustment",
  });
  if (ledgerErr) return { ok: false, error: ledgerErr.message };

  revalidate(userId);
  return { ok: true };
}

/** Assign (or clear, with null) the customer's loyalty card / tier. */
export async function setTier(userId: string, tierId: string | null): Promise<ActionResult> {
  const { error } = await createAdminClient()
    .from("loyalty_account")
    .upsert({ user_id: userId, current_tier_id: tierId }, { onConflict: "user_id" });
  if (error) return { ok: false, error: error.message };
  revalidate(userId);
  return { ok: true };
}

/** Issue a personal coupon code (percent off) for the customer to use. */
export async function issueCoupon(userId: string, customerName: string, percent: number): Promise<CouponResult> {
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return { ok: false, error: "Enter a discount between 1 and 100%." };
  const code = `BS-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const { error } = await createAdminClient().from("promo_code").insert({
    code,
    discount_type: "percent",
    discount_value: Math.round(percent),
    description: `Issued to ${customerName}`,
    per_user_limit: 1,
    is_active: true,
  });
  if (error) return { ok: false, error: error.message };
  revalidate(userId);
  return { ok: true, code };
}

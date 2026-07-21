"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { createAuthServerClient, requireStaff } from "@/lib/supabase/auth-server";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CouponResult = { ok: true; code: string } | { ok: false; error: string };

function revalidate(userId: string) {
  revalidatePath("/customers");
  revalidatePath(`/customers/${userId}`);
}

export async function setCustomerBlocked(id: string, blocked: boolean): Promise<ActionResult> {
  await requireStaff();
  const { error } = await createAdminClient().from("app_user").update({ is_blocked: blocked }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate(id);
  return { ok: true };
}

/** Add (or deduct, with negative delta) loyalty points, recording a ledger entry. */
export async function grantPoints(userId: string, delta: number, reason: string): Promise<ActionResult> {
  await requireStaff();
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
  await requireStaff();
  const { error } = await createAdminClient()
    .from("loyalty_account")
    .upsert({ user_id: userId, current_tier_id: tierId }, { onConflict: "user_id" });
  if (error) return { ok: false, error: error.message };
  revalidate(userId);
  return { ok: true };
}

/** Issue a personal coupon code (percent off) — and tell the customer about it.
 *  The notification rides fn_notify_user (staff-gated in the DB, RLS-scoped to
 *  this one customer): inbox instantly, banner if they're in the app, push if on. */
export async function issueCoupon(userId: string, customerName: string, percent: number): Promise<CouponResult> {
  await requireStaff();
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return { ok: false, error: "Enter a discount between 1 and 100%." };
  const pct = Math.round(percent);
  const code = `BS-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const { error } = await createAdminClient().from("promo_code").insert({
    code,
    discount_type: "percent",
    discount_value: pct,
    description: `Issued to ${customerName}`,
    issued_to_user_id: userId, // powers the customer's coupon wallet (RLS: only they see it)
    per_user_limit: 1,
    is_active: true,
  });
  if (error) return { ok: false, error: error.message };

  // Best-effort: the coupon exists either way; the notice runs on the STAFF session
  // so the DB's is_staff() gate does the authorizing.
  const auth = await createAuthServerClient();
  await auth.rpc("fn_notify_user", {
    p_user_id: userId,
    p_title: `${pct}% off your next order`,
    p_body: `Use code ${code} at checkout.`,
    p_kind: "promo",
  });

  revalidate(userId);
  return { ok: true, code };
}

"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/supabase/auth-server";

export type OrderStatus =
  | "pending_payment"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned";

export type ActionResult = { ok: true } | { ok: false; error: string };

const STAMP: Partial<Record<OrderStatus, string>> = {
  confirmed: "confirmed_at",
  delivered: "delivered_at",
  cancelled: "cancelled_at",
  returned: "returned_at",
};

export async function setOrderStatus(id: string, status: OrderStatus): Promise<ActionResult> {
  await requireStaff();
  const patch: Record<string, unknown> = { status };
  const col = STAMP[status];
  if (col) patch[col] = new Date().toISOString();

  const { error } = await createAdminClient().from("order").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/dispatch");
  revalidatePath("/");
  return { ok: true };
}

/** Cancel a still-unpaid Monime order: releases its stock hold and expires
 *  the payment_intent — a blind `setOrderStatus(id, "cancelled")` would
 *  leave the reservation stuck forever. There is no manual "confirm" path:
 *  pending_payment -> confirmed only ever happens via the verified webhook. */
export async function cancelPendingMonimeOrder(id: string): Promise<ActionResult> {
  const staff = await requireStaff();
  const { data, error } = await createAdminClient().rpc("fn_cancel_pending_monime_order", {
    p_order_id: id,
    p_actor: staff.id,
  });
  if (error) return { ok: false, error: error.message };
  if (data !== "cancelled") return { ok: false, error: `Couldn't cancel (${data}) — refresh and try again.` };

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/dispatch");
  revalidatePath("/");
  return { ok: true };
}

/** Mark a flagged payment as dealt with.
 *
 *  Monime has no refund API, so the actual money movement happens by hand in
 *  their dashboard (docs/08 §7). This records that it was done, which is the
 *  only thing that takes the row out of the Orders banner. Without it the
 *  banner accumulates items nobody can clear, and an alert that never clears
 *  is one people stop reading.
 *
 *  `monimeRef` is whatever reference the Monime dashboard gives for the refund —
 *  optional, because staff may resolve a row by re-placing the order instead. */
export async function resolvePaymentAttention(
  refundId: string,
  outcome: "completed" | "manual_processing",
  monimeRef?: string,
): Promise<ActionResult> {
  const staff = await requireStaff();

  const patch: Record<string, unknown> = { status: outcome, updated_at: new Date().toISOString() };
  if (outcome === "completed") {
    patch.completed_at = new Date().toISOString();
    patch.processed_by = staff.id;
  }
  const ref = monimeRef?.trim();
  if (ref) patch.monime_dashboard_ref = ref;

  const { error } = await createAdminClient().from("refund").update(patch).eq("id", refundId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/orders");
  return { ok: true };
}

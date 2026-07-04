"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Receive units into stock (qty_on_hand += qty), recording a stock_ledger movement. */
export async function receiveStock(variantId: string, qty: number): Promise<ActionResult> {
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Enter a positive quantity." };
  const { error } = await createAdminClient().rpc("fn_receive_stock", {
    p_variant: variantId,
    p_qty: Math.floor(qty),
    p_reason: "Received via admin",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory");
  revalidatePath("/");
  return { ok: true };
}

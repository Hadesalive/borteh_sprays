"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/supabase/auth-server";

export type SaleLine = {
  variantId: string;
  name: string;
  label: string;
  sku: string;
  unitPriceMinor: number;
  qty: number;
};

export type PosPayment = "cash" | "mobile_money";

export type SaleResult = { ok: true; saleId: string; receiptNumber: string } | { ok: false; error: string };
export type VoidResult = { ok: true } | { ok: false; error: string };

const STORE_ID = "c704bc0f-2122-4815-993e-42a83028cae6";

/**
 * Record a counter sale via the atomic fn_pos_sale RPC: a till receipt
 * (pos_sale + items, attributed to the signed-in cashier) with stock taken
 * off the shelf in the same transaction. Counter sales never touch "order".
 */
export async function createPosSale(
  lines: SaleLine[],
  payment: PosPayment,
  reference: string | null,
  discountMinor = 0,
): Promise<SaleResult> {
  const staff = await requireStaff();
  if (lines.length === 0) return { ok: false, error: "Cart is empty." };
  if (payment !== "cash" && payment !== "mobile_money") return { ok: false, error: "Choose cash or mobile money." };

  const p_items = lines.map((l) => ({
    variant_id: l.variantId,
    name: l.name,
    label: l.label,
    sku: l.sku,
    unit_price_minor: l.unitPriceMinor,
    qty: l.qty,
  }));

  const { data, error } = await createAdminClient().rpc("fn_pos_sale", {
    p_store: STORE_ID,
    p_cashier: staff.id,
    p_payment: payment,
    p_reference: reference?.trim() || null,
    p_items,
    p_discount_minor: Math.max(0, Math.round(discountMinor)),
  });
  if (error) return { ok: false, error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  const saleId = row?.sale_id as string | undefined;
  const receiptNumber = row?.receipt_number as string | undefined;
  if (!saleId || !receiptNumber) return { ok: false, error: "The sale did not come back with a receipt number." };

  revalidatePath("/pos");
  revalidatePath("/pos/sales");
  revalidatePath("/inventory");
  revalidatePath("/analytics");
  revalidatePath("/");
  return { ok: true, saleId, receiptNumber };
}

/** Void a completed till sale: stock returns to the shelf, the receipt stays on record. */
export async function voidPosSale(saleId: string, reason: string): Promise<VoidResult> {
  const staff = await requireStaff();
  const why = reason.trim();
  if (!why) return { ok: false, error: "A reason is required." };

  const { data, error } = await createAdminClient().rpc("fn_void_pos_sale", {
    p_sale: saleId,
    p_actor: staff.id,
    p_reason: why,
  });
  if (error) return { ok: false, error: error.message };
  if (data !== true) return { ok: false, error: "This sale has already been voided." };

  revalidatePath("/pos");
  revalidatePath("/pos/sales");
  revalidatePath(`/pos/sales/${saleId}`);
  revalidatePath("/inventory");
  revalidatePath("/analytics");
  revalidatePath("/");
  return { ok: true };
}

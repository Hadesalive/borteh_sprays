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

export type SaleResult = { ok: true; orderNumber: string } | { ok: false; error: string };

const STORE_ID = "c704bc0f-2122-4815-993e-42a83028cae6";
// Counter sales are attributed to the "Walk-in customer" app_user.
const WALKIN_USER_ID = "6e07c287-bb72-45d2-b003-30b56da03a47";

/**
 * Record a counter (POS) sale via the atomic fn_pos_sale RPC: creates a pickup
 * order + items and moves stock (reserve → confirm) in one transaction, so the
 * deferred order-subtotal constraint passes.
 */
export async function createPosSale(lines: SaleLine[], payment: "cash" | "monime", discountMinor = 0): Promise<SaleResult> {
  await requireStaff();
  if (lines.length === 0) return { ok: false, error: "Cart is empty." };

  const p_items = lines.map((l) => ({
    variant_id: l.variantId,
    name: l.name,
    label: l.label,
    sku: l.sku,
    unit_price_minor: l.unitPriceMinor,
    qty: l.qty,
  }));

  const { data, error } = await createAdminClient().rpc("fn_pos_sale", {
    p_user: WALKIN_USER_ID,
    p_store: STORE_ID,
    p_payment: payment === "monime" ? "monime" : "cash_on_delivery",
    p_items,
    p_discount_minor: Math.max(0, Math.round(discountMinor)),
  });
  if (error) return { ok: false, error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  const orderNumber = (row?.order_number as string) ?? "";

  revalidatePath("/orders");
  revalidatePath("/inventory");
  revalidatePath("/");
  return { ok: true, orderNumber };
}

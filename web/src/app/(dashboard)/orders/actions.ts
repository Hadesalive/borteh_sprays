"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

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

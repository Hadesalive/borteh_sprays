"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setZoneFee(id: string, feeMinor: number): Promise<ActionResult> {
  if (!Number.isFinite(feeMinor) || feeMinor < 0) return { ok: false, error: "Enter a valid fee." };
  const { error } = await createAdminClient()
    .from("delivery_zone")
    .update({ estimated_fee_minor: Math.round(feeMinor) })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/zones");
  return { ok: true };
}

export async function setZoneActive(id: string, active: boolean): Promise<ActionResult> {
  const { error } = await createAdminClient().from("delivery_zone").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/zones");
  return { ok: true };
}

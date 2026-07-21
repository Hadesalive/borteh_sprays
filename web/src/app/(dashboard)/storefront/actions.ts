"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/supabase/auth-server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setSlideActive(id: string, active: boolean): Promise<ActionResult> {
  await requireStaff();
  const { error } = await createAdminClient().from("home_carousel").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/storefront");
  return { ok: true };
}

export async function deleteSlide(id: string): Promise<ActionResult> {
  await requireStaff();
  const { error } = await createAdminClient()
    .from("home_carousel")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/storefront");
  return { ok: true };
}

export async function setScentActive(id: string, active: boolean): Promise<ActionResult> {
  await requireStaff();
  const { error } = await createAdminClient().from("home_scent_family").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/storefront");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateStore(
  id: string,
  input: { name: string; address: string }
): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Enter a store name." };

  const { error } = await createAdminClient()
    .from("store_location")
    .update({ name, address_text: input.address.trim() || null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/store");
  revalidatePath("/settings");
  return { ok: true };
}

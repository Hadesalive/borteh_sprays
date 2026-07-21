"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/supabase/auth-server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateStore(
  id: string,
  input: { name: string; address: string; phone: string }
): Promise<ActionResult> {
  await requireStaff();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Enter a store name." };
  const phone = input.phone.replace(/[^\d+]/g, ""); // digits only — feeds the app's WhatsApp link

  const { error } = await createAdminClient()
    .from("store_location")
    .update({ name, address_text: input.address.trim() || null, phone: phone || null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/store");
  revalidatePath("/settings");
  return { ok: true };
}

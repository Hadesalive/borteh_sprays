"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { getStaffUser } from "@/lib/supabase/auth-server";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Upsert one copy value. Passing an empty string clears the override (the app then falls back to
 * the bundled default), so an owner can always revert a key to shipped copy.
 */
export async function saveContent(key: string, value: string): Promise<ActionResult> {
  const staff = await getStaffUser();
  if (!staff) return { ok: false, error: "Not authorized — staff sign-in required." };
  if (!key.trim()) return { ok: false, error: "Missing content key." };

  const { error } = await createAdminClient()
    .from("app_content")
    .upsert(
      { key, kind: "text", value_text: value.trim() === "" ? null : value, updated_by: staff.id },
      { onConflict: "key" }
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/content/copy");
  return { ok: true };
}

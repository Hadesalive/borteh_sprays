"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { createAuthServerClient } from "@/lib/supabase/auth-server";

export type ActionResult = { ok: true } | { ok: false; error: string };

type NotifField = "in_app_enabled" | "push_enabled" | "marketing_opt_in";

export async function updateNotifPref(field: NotifField, value: boolean): Promise<ActionResult> {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await createAdminClient()
    .from("notification_preference")
    .upsert({ user_id: user.id, [field]: value }, { onConflict: "user_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/notifications");
  return { ok: true };
}

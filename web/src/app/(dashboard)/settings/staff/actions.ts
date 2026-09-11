"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/supabase/auth-server";

export type StaffResult = { ok: true } | { ok: false; error: string };
export type StaffRole = "owner" | "staff";

/**
 * Admin access hangs off TWO things and they must move together:
 *
 *  - `auth.users.app_metadata.role` — what `web/src/proxy.ts` gates every
 *    request on. Without it the person is bounced to /login no matter what
 *    the database says.
 *  - `app_user.role` — what `is_staff()` and RLS read, and what the rest of
 *    the admin displays.
 *
 * Setting only one produces a confusing half-state (can't get past the door
 * but shows as staff, or vice versa), so every mutation here writes both.
 */
async function setRoleEverywhere(userId: string, role: StaffRole | "customer"): Promise<string | null> {
  const db = createAdminClient();

  const { error: metaError } = await db.auth.admin.updateUserById(userId, { app_metadata: { role } });
  if (metaError) return metaError.message;

  const { error: rowError } = await db.from("app_user").update({ role }).eq("id", userId);
  if (rowError) return rowError.message;

  return null;
}

/** Owners currently able to administer the shop. Used to prevent lockout. */
async function ownerCount(): Promise<number> {
  const { count } = await createAdminClient()
    .from("app_user")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner");
  return count ?? 0;
}

export async function createStaff(input: {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
}): Promise<StaffResult> {
  await requireOwner();

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "Give them a name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "That doesn't look like an email address." };
  if (input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (input.role !== "owner" && input.role !== "staff") return { ok: false, error: "Pick a role." };

  const db = createAdminClient();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: input.password,
    // There's no mail delivery in this project, so a confirmation link would
    // never arrive and the account could never be used.
    email_confirm: true,
    user_metadata: { display_name: name },
    app_metadata: { role: input.role },
  });
  if (error) {
    return {
      ok: false,
      error: /already registered|already been registered/i.test(error.message)
        ? "Someone already has an account with that email."
        : error.message,
    };
  }

  const userId = data.user?.id;
  if (!userId) return { ok: false, error: "The account was not created. Try again." };

  // The auth trigger creates the app_user row with the default 'customer'
  // role; app_metadata alone wouldn't show them as staff in the admin.
  const { error: roleError } = await db.from("app_user").update({ role: input.role }).eq("id", userId);
  if (roleError) return { ok: false, error: roleError.message };

  revalidatePath("/settings/staff");
  revalidatePath("/settings");
  return { ok: true };
}

export async function setStaffRole(userId: string, role: StaffRole): Promise<StaffResult> {
  const me = await requireOwner();
  if (userId === me.id) return { ok: false, error: "You can't change your own role." };
  if (role !== "owner" && role !== "staff") return { ok: false, error: "Pick a role." };

  const db = createAdminClient();
  const { data: current } = await db.from("app_user").select("role").eq("id", userId).maybeSingle();
  const wasOwner = (current as { role?: string } | null)?.role === "owner";
  if (wasOwner && role !== "owner" && (await ownerCount()) <= 1) {
    return { ok: false, error: "That's the only owner — promote someone else first." };
  }

  const failure = await setRoleEverywhere(userId, role);
  if (failure) return { ok: false, error: failure };

  revalidatePath("/settings/staff");
  return { ok: true };
}

/**
 * Take away admin access without destroying the person. Demoting to 'customer'
 * keeps their orders, reviews and loyalty intact and simply shuts the admin
 * door; deleting the auth user would cascade far more than intended.
 */
export async function revokeStaff(userId: string): Promise<StaffResult> {
  const me = await requireOwner();
  if (userId === me.id) return { ok: false, error: "You can't remove your own access." };

  const db = createAdminClient();
  const { data: current } = await db.from("app_user").select("role").eq("id", userId).maybeSingle();
  if ((current as { role?: string } | null)?.role === "owner" && (await ownerCount()) <= 1) {
    return { ok: false, error: "That's the only owner — promote someone else first." };
  }

  const failure = await setRoleEverywhere(userId, "customer");
  if (failure) return { ok: false, error: failure };

  revalidatePath("/settings/staff");
  revalidatePath("/settings");
  return { ok: true };
}

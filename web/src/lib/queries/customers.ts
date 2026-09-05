import type { SupabaseClient } from "@supabase/supabase-js";

export const PAGE_SIZE = 50;

export type CustomerRecord = {
  id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  is_blocked: boolean | null;
  created_at: string | null;
};

/** One page of customers, newest first. Always bounded. */
export async function listCustomers(
  db: SupabaseClient,
  { page, pageSize = PAGE_SIZE }: { page: number; pageSize?: number },
): Promise<{ rows: CustomerRecord[]; total: number }> {
  const from = page * pageSize;
  const { data, count, error } = await db
    .from("app_user")
    .select("id, display_name, phone, email, role, is_blocked, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { rows: (data ?? []) as CustomerRecord[], total: count ?? 0 };
}

/** Total customers currently blocked — a cheap indexed count, not a row scan. */
export async function getBlockedCustomerCount(db: SupabaseClient): Promise<number> {
  const { count, error } = await db.from("app_user").select("id", { count: "exact", head: true }).eq("is_blocked", true);
  if (error) throw error;
  return count ?? 0;
}

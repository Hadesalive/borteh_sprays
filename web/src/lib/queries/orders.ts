import type { SupabaseClient } from "@supabase/supabase-js";

export const PAGE_SIZE = 50;

export type OrderRecord = {
  id: string;
  order_number: string | null;
  status: string;
  fulfillment_type: string | null;
  payment_method: string | null;
  total_minor: number;
  created_at: string;
  placed_at: string | null;
  user_id: string | null;
};

export type OrderStats = {
  pending_count: number;
  confirmed_count: number;
  out_for_delivery_count: number;
  delivered_7d_count: number;
  cancelled_count: number;
  cod_to_collect_minor: number;
};

const COLUMNS =
  "id, order_number, status, fulfillment_type, payment_method, total_minor, created_at, placed_at, user_id";

/** One page of orders, newest first. Always bounded. */
export async function listOrders(
  db: SupabaseClient,
  { page, pageSize = PAGE_SIZE }: { page: number; pageSize?: number },
): Promise<{ rows: OrderRecord[]; total: number }> {
  const from = page * pageSize;
  const { data, count, error } = await db
    .from("order")
    .select(COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { rows: (data ?? []) as OrderRecord[], total: count ?? 0 };
}

/** The six numbers in the Orders summary strip, computed in SQL. */
export async function getOrderStats(db: SupabaseClient): Promise<OrderStats> {
  const { data, error } = await db.from("admin_order_stats").select("*").single();
  if (error) throw error;
  return data as OrderStats;
}

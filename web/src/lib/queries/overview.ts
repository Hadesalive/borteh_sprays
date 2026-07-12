import type { SupabaseClient } from "@supabase/supabase-js";

export type OverviewStats = {
  revenue_today_minor: number;
  revenue_7d_minor: number;
  revenue_prev_7d_minor: number;
  orders_7d: number;
  orders_prev_7d: number;
  pending_count: number;
  confirmed_count: number;
  out_for_delivery_count: number;
  delivered_7d_count: number;
  items_sold_7d: number;
  low_stock_count: number;
  out_of_stock_count: number;
  restock_waiting_count: number;
};

export type RevenueDay = { day: string; revenue_minor: number };
export type TopSeller = { product_name: string; variant_label: string; revenue_minor: number };
export type LowStockRow = { product_name: string; size_ml: number; qty_available: number };
export type RestockRow = { product_name: string; size_ml: number; subscriber_count: number };
export type QueueRow = {
  id: string;
  order_number: string | null;
  status: string;
  total_minor: number;
  customer_name: string;
  placed_at: string;
};

export type OverviewPanels = {
  revenueDaily: RevenueDay[];
  topSellers: TopSeller[];
  lowStock: LowStockRow[];
  restockDemand: RestockRow[];
  queue: QueueRow[];
};

/** One bounded row. Replaces three whole-table selects. */
export async function getOverviewStats(
  db: SupabaseClient,
): Promise<OverviewStats> {
  const { data, error } = await db
    .from("admin_overview_stats")
    .select("*")
    .single();
  if (error) throw error;
  return data as OverviewStats;
}

/**
 * The Overview's five panels. Every view carries its own LIMIT, so none of
 * these can grow with the shop's history.
 */
export async function getOverviewPanels(
  db: SupabaseClient,
): Promise<OverviewPanels> {
  const [daily, top, low, restock, queue] = await Promise.all([
    db.from("admin_revenue_daily").select("*"),
    db.from("admin_top_sellers").select("*"),
    db.from("admin_low_stock").select("*"),
    db.from("admin_restock_demand").select("*"),
    db.from("admin_order_queue").select("*"),
  ]);

  for (const r of [daily, top, low, restock, queue]) {
    if (r.error) throw r.error;
  }

  return {
    revenueDaily: (daily.data ?? []) as RevenueDay[],
    topSellers: (top.data ?? []) as TopSeller[],
    lowStock: (low.data ?? []) as LowStockRow[],
    restockDemand: (restock.data ?? []) as RestockRow[],
    queue: (queue.data ?? []) as QueueRow[],
  };
}

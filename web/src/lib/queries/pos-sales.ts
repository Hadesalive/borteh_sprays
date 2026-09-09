import type { SupabaseClient } from "@supabase/supabase-js";

export const POS_PAGE_SIZE = 50;

export type PosSaleStatus = "completed" | "voided";
export type PosPaymentMethod = "cash" | "mobile_money";

export type PosSaleRecord = {
  id: string;
  receipt_number: string;
  cashier_id: string | null;
  payment_method: PosPaymentMethod;
  payment_reference: string | null;
  subtotal_minor: number;
  discount_minor: number;
  total_minor: number;
  status: PosSaleStatus;
  void_reason: string | null;
  voided_by: string | null;
  voided_at: string | null;
  sold_at: string;
};

export type PosSaleItem = {
  product_name_snapshot: string;
  variant_label_snapshot: string;
  sku_snapshot: string;
  unit_price_minor: number;
  qty: number;
  line_total_minor: number;
};

/** Today's till, from midnight local to now, completed sales only. */
export type PosTodayStats = {
  receipts: number;
  total_minor: number;
  cash_minor: number;
  mobile_money_minor: number;
  voided: number;
};

const COLUMNS =
  "id, receipt_number, cashier_id, payment_method, payment_reference, subtotal_minor, discount_minor, total_minor, status, void_reason, voided_by, voided_at, sold_at";

/** One page of receipts, newest first. Always bounded. */
export async function listPosSales(
  db: SupabaseClient,
  { page, pageSize = POS_PAGE_SIZE }: { page: number; pageSize?: number },
): Promise<{ rows: PosSaleRecord[]; total: number }> {
  const from = page * pageSize;
  const { data, count, error } = await db
    .from("pos_sale")
    .select(COLUMNS, { count: "exact" })
    .order("sold_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []) as PosSaleRecord[], total: count ?? 0 };
}

/** Pure: fold a day's receipts into the summary strip. Exported for tests. */
export function summarizeTill(rows: Pick<PosSaleRecord, "payment_method" | "total_minor" | "status">[]): PosTodayStats {
  const stats: PosTodayStats = { receipts: 0, total_minor: 0, cash_minor: 0, mobile_money_minor: 0, voided: 0 };
  for (const r of rows) {
    if (r.status === "voided") {
      stats.voided += 1;
      continue;
    }
    stats.receipts += 1;
    stats.total_minor += r.total_minor;
    if (r.payment_method === "cash") stats.cash_minor += r.total_minor;
    else stats.mobile_money_minor += r.total_minor;
  }
  return stats;
}

export async function getTodayTill(db: SupabaseClient): Promise<PosTodayStats> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data, error } = await db
    .from("pos_sale")
    .select("payment_method, total_minor, status")
    .gte("sold_at", start.toISOString());
  if (error) throw error;
  return summarizeTill((data ?? []) as Pick<PosSaleRecord, "payment_method" | "total_minor" | "status">[]);
}

export async function getPosSale(
  db: SupabaseClient,
  id: string,
): Promise<{ sale: PosSaleRecord; items: PosSaleItem[] } | null> {
  const { data: sale, error } = await db.from("pos_sale").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!sale) return null;
  const { data: items, error: itemsError } = await db
    .from("pos_sale_item")
    .select("product_name_snapshot, variant_label_snapshot, sku_snapshot, unit_price_minor, qty, line_total_minor")
    .eq("sale_id", id);
  if (itemsError) throw itemsError;
  return { sale: sale as PosSaleRecord, items: (items ?? []) as PosSaleItem[] };
}

/** display_name per app_user id, for the cashier / voided-by columns. */
export async function getStaffNames(db: SupabaseClient, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;
  const { data, error } = await db.from("app_user").select("id, display_name").in("id", unique);
  if (error) throw error;
  for (const u of (data ?? []) as Array<{ id: string; display_name: string | null }>) {
    names.set(u.id, u.display_name ?? "");
  }
  return names;
}

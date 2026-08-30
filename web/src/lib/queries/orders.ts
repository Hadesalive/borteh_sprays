import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentChannel } from "@/lib/payment-channel";

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

/** Every webhook event that means "this payment went through". Must stay in
 *  lockstep with COMPLETION_EVENTS in supabase/functions/monime-webhook/index.ts.
 *  `payment_code.completed` is the one the live USSD flow actually fires — it was
 *  missing here, so every Monime order since the switch to Payment Codes fell
 *  back to the generic "Monime" label with no error anywhere. */
const COMPLETION_EVENT_TYPES = new Set([
  "payment.completed",
  "payment.processing_completed",
  "payment_code.completed",
]);

/** Where the paying rail actually lives, confirmed against the real captured
 *  payloads for order BS-2026-000043 (payment_webhook, 2026-08-29):
 *
 *  - `payment.completed` / `payment.processing_completed` carry the full
 *    `data.channel` ({type:"momo", provider:"m17", phoneNumber, reference}).
 *    This is the only event that has it.
 *  - `payment_code.completed` carries NO channel whatsoever — `data.channel` is
 *    absent and `data.processedPaymentData` is null. What it does carry is the
 *    `momo_provider` we ourselves put in `metadata` at code creation, and
 *    `authorizedProviders`, which locks the code to exactly one rail — so the
 *    provider is still recoverable, just not from a `channel` object.
 *
 *  Hence the fallback: prefer Monime's own channel, else synthesise one from the
 *  payment-code's single authorized provider. Anything else yields a plain
 *  "Monime" label rather than a wrong one. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function channelFromPayload(payload: any): PaymentChannel {
  const data = payload?.data;
  if (data?.channel?.type) return data.channel;
  const provider = data?.metadata?.momo_provider ?? (Array.isArray(data?.authorizedProviders) && data.authorizedProviders.length === 1 ? data.authorizedProviders[0] : null);
  return typeof provider === "string" && provider ? { type: "momo", provider } : null;
}

/** order_id -> the specific channel (Orange Money, Card, ...) Monime confirmed
 *  the payment on, read from the completion webhook's captured payload —
 *  there's no dedicated column for this, so it's resolved on demand.
 *  Bounded by the caller's order id list (a page of orders, never the whole table). */
export async function getMonimeChannels(db: SupabaseClient, orderIds: string[]): Promise<Map<string, PaymentChannel>> {
  const map = new Map<string, PaymentChannel>();
  if (orderIds.length === 0) return map;

  const { data, error } = await db
    .from("payment_intent")
    .select("order_id, payment_webhook(payload, event_type, processed)")
    .in("order_id", orderIds)
    .eq("provider", "monime");
  if (error || !data) return map;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const intent of data as any[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hits = (intent.payment_webhook ?? []).filter((w: any) => w.processed && COMPLETION_EVENT_TYPES.has(w.event_type));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = hits.map((w: any) => channelFromPayload(w.payload)).find((c: PaymentChannel) => c?.type);
    if (channel) map.set(intent.order_id, channel);
  }
  return map;
}

/** A payment that moved money but has no matching fulfilled order — today that
 *  means a Monime confirmation that landed after the reservation sweep (or a
 *  staff cancel) had already killed the order. fn_confirm_monime_payment files
 *  these into public.refund; admin_payment_attention is the read side.
 *  See 20260829115411_late_monime_confirmation.sql. */
export type PaymentAttentionRow = {
  refund_id: string;
  order_id: string;
  order_number: string | null;
  order_status: string;
  intent_status: string | null;
  amount_minor: number;
  currency: string;
  reason: string | null;
  notes: string | null;
  requested_at: string;
  /** 'pending' until a staff member picks it up; 'manual_processing' while they do. */
  refund_status: string;
};

/** Unresolved payment exceptions, oldest first — a customer waiting on their
 *  money should be the one at the top. Bounded; never selects the whole table. */
export async function getPaymentsNeedingAttention(
  db: SupabaseClient,
  { limit = 20 }: { limit?: number } = {},
): Promise<PaymentAttentionRow[]> {
  const { data, error } = await db
    .from("admin_payment_attention")
    .select("refund_id, order_id, order_number, order_status, intent_status, amount_minor, currency, reason, notes, requested_at, refund_status")
    .order("requested_at", { ascending: true })
    .limit(limit);
  // Never let this take the Orders page down — it's a banner, not the content.
  if (error || !data) return [];
  return data as PaymentAttentionRow[];
}

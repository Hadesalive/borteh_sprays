import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

export type OrderStatus = "pending_payment" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled" | "returned";
export type PaymentMethod = "cash_on_delivery" | "monime";
export type OrderLine = { name: string; label: string; qty: number; unitPriceMinor: number; lineTotalMinor: number };
export type Order = {
  id: string;
  number: string;
  status: OrderStatus;
  /** Only set once status is cancelled/returned — drives which explanation the
   *  order screen shows ("you cancelled it" vs "payment window closed" vs "cancelled by staff"). */
  cancelReason: string | null;
  paymentMethod: PaymentMethod;
  /** Set only while a Monime payment is outstanding — lets the order screen retry it. */
  paymentIntentId: string | null;
  /** "m17" | "m18" — the mobile-money provider the customer originally picked, from
   *  payment_intent.metadata (set by payment-init). Needed to regenerate the same
   *  USSD code on retry without asking the customer to pick a provider again. */
  momoProvider: string | null;
  /** When the currently-shown USSD code stops being dialable — drives the
   *  countdown on the USSD/pending-payment screens. Null once paid/cancelled. */
  ussdCodeExpiresAt: string | null;
  subtotalMinor: number;
  deliveryFeeMinor: number | null;
  discountMinor: number;
  loyaltyRedeemMinor: number;
  totalMinor: number;
  landmark: string | null;
  phone: string | null;
  recipientName: string | null;
  placedAt: string | null;
  items: OrderLine[];
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting confirmation",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

/** Badge tone per status — semantic tint only (delivered reads neutral). */
export const STATUS_TONE: Record<OrderStatus, "muted" | "success" | "warning" | "error"> = {
  pending_payment: "warning",
  confirmed: "warning",
  preparing: "warning",
  out_for_delivery: "warning",
  delivered: "muted",
  cancelled: "error",
  returned: "error",
};

/** Place an order via the server RPC (atomic order + items + stock hold).
 *  The promo code is re-validated and priced SERVER-side — the client only previews.
 *  paymentMethod "monime" leaves the order pending_payment and returns a
 *  paymentIntentId — the caller must follow up with initMonimeCheckout(). */
export async function placeOrder(input: {
  items: { variant_id: string; qty: number }[];
  landmark: string;
  phone: string;
  recipientName: string;
  notes?: string;
  promoCode?: string | null;
  redeemPoints?: number;
  combos?: { combo_id: string; qty: number }[];
  paymentMethod?: PaymentMethod;
}): Promise<{ orderId: string; orderNumber: string; paymentIntentId: string | null }> {
  const { data, error } = await supabase.rpc("fn_place_order", {
    p_items: input.items,
    p_landmark: input.landmark,
    p_contact_phone: input.phone,
    p_recipient_name: input.recipientName,
    p_zone_id: null,
    p_notes: input.notes ?? null,
    p_promo_code: input.promoCode ?? null,
    p_redeem_points: input.redeemPoints ?? 0,
    p_combos: input.combos ?? [],
    p_payment_method: input.paymentMethod ?? "cash_on_delivery",
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { orderId: row.order_id, orderNumber: row.order_number, paymentIntentId: row.payment_intent_id ?? null };
}

/** Customer self-service cancel — server enforces ownership AND that the
 *  order is still pending_payment (fn_cancel_own_order). A confirmed order
 *  is a real refund/support conversation, not a one-tap action, so this
 *  simply won't apply past that point. */
export async function cancelOrder(orderId: string): Promise<void> {
  const { data, error } = await supabase.rpc("fn_cancel_own_order", { p_order_id: orderId });
  if (error) throw error;
  if (data === "not_cancellable") throw new Error("This order can no longer be cancelled. It's already being prepared.");
  if (data === "not_found") throw new Error("Order not found.");
  if (data !== "cancelled") throw new Error("Couldn't cancel this order. Try again.");
}

const ORDER_SELECT =
  "id, order_number, status, cancel_reason, payment_method, subtotal_minor, delivery_fee_minor, discount_minor, loyalty_redeem_minor, total_minor, " +
  "landmark_snapshot, contact_phone_snapshot, recipient_name_snapshot, placed_at, created_at, " +
  "order_item(product_name_snapshot, variant_label_snapshot, qty, unit_price_minor, line_total_minor), " +
  "payment_intent(id, status, metadata, ussd_code_expires_at)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(r: any): Order {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openIntent = (r.payment_intent ?? []).find((pi: any) => pi.status === "created" || pi.status === "processing");
  return {
    id: r.id,
    number: r.order_number,
    status: r.status,
    cancelReason: r.cancel_reason ?? null,
    paymentMethod: r.payment_method,
    paymentIntentId: openIntent?.id ?? null,
    momoProvider: openIntent?.metadata?.momo_provider ?? null,
    ussdCodeExpiresAt: openIntent?.ussd_code_expires_at ?? null,
    subtotalMinor: r.subtotal_minor,
    deliveryFeeMinor: r.delivery_fee_minor,
    discountMinor: r.discount_minor ?? 0,
    loyaltyRedeemMinor: r.loyalty_redeem_minor ?? 0,
    totalMinor: r.total_minor,
    landmark: r.landmark_snapshot,
    phone: r.contact_phone_snapshot,
    recipientName: r.recipient_name_snapshot,
    placedAt: r.placed_at ?? r.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (r.order_item ?? []).map((i: any) => ({
      name: i.product_name_snapshot,
      label: i.variant_label_snapshot,
      qty: i.qty,
      unitPriceMinor: i.unit_price_minor,
      lineTotalMinor: i.line_total_minor,
    })),
  };
}

/** The signed-in customer's orders (RLS scopes to own). */
export function useOrders() {
  return useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("order").select(ORDER_SELECT).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(normalize);
    },
  });
}

export function useOrder(id?: string) {
  return useQuery<Order | null>({
    queryKey: ["order", id],
    enabled: !!id,
    // A Monime order sits pending_payment until the webhook confirms it — poll
    // briefly so the order screen flips to "Confirmed" on its own instead of
    // needing a manual pull-to-refresh. Any other status stops the polling.
    refetchInterval: (query) => (query.state.data?.status === "pending_payment" ? 3000 : false),
    queryFn: async () => {
      const { data, error } = await supabase.from("order").select(ORDER_SELECT).eq("id", id!).maybeSingle();
      if (error) throw error;
      return data ? normalize(data) : null;
    },
  });
}

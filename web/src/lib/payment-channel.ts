import { humanize } from "@/components/admin/chip";

/** Shape of a Monime webhook event's `data.channel` object — captured from a
 *  real payment.processing_completed payload, not from docs (Monime's public
 *  docs don't cover this shape for checkout-session payments). */
export type PaymentChannel = {
  type?: string | null;
  provider?: string | null;
  phoneNumber?: string | null;
} | null | undefined;

// Resolved against the live `GET /v1/momos?country=SL` provider list —
// Monime's own error/reference docs don't publish this mapping anywhere.
// m13 (QMoney) is currently inactive on Monime's side but kept here in case
// a historical order used it.
const MOMO_PROVIDER_NAMES: Record<string, string> = {
  m17: "Orange Money",
  m18: "Afrimoney",
  m13: "QMoney",
};

/** "Orange Money" / "Card" / "Bank Transfer" / etc., or null if there's no
 *  channel yet (payment still pending, or this is a pre-webhook-capture order). */
export function describePaymentChannel(channel: PaymentChannel): string | null {
  if (!channel?.type) return null;
  if (channel.type === "momo") {
    return (channel.provider && MOMO_PROVIDER_NAMES[channel.provider]) || "Mobile Money";
  }
  if (channel.type === "card") return "Card";
  if (channel.type === "bank") return "Bank Transfer";
  if (channel.type === "wallet") return "Wallet";
  return humanize(channel.type);
}

/** The one payment-method label used across the admin — dashboard overview,
 *  orders list, and order detail all import this instead of keeping their
 *  own copy, so "Monime — Orange Money" reads the same everywhere. */
export function paymentLabel(method: string | null | undefined, channel?: PaymentChannel): string {
  if (method === "monime") {
    const specific = describePaymentChannel(channel);
    return specific ? `Monime — ${specific}` : "Monime";
  }
  switch (method) {
    case "cash_on_delivery": return "COD";
    case "cash": return "Cash";
    case "card": return "Card";
    default: return method ? humanize(method) : "—";
  }
}

import { supabase } from "./supabase";

/** Monime's own mobile-money provider ids (confirmed live via GET /v1/momos?country=SL). */
export type MomoProvider = "m17" | "m18"; // m17 = Orange Money, m18 = Afrimoney

/** Shared across checkout, order retry, and the default-payment setting —
 *  one source of truth so the label/mark never drifts between screens. */
export const MOMO_LABEL: Record<MomoProvider, string> = { m17: "Orange Money", m18: "Afrimoney" };
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const MOMO_LOGO: Record<MomoProvider, number> = { m17: require("@/assets/payments/orange-money.png"), m18: require("@/assets/payments/afrimoney.png") };

/** Creates a Monime Payment Code (USSD) for a payment_intent fn_place_order
 *  already created (status='created'). momoProvider is required — it locks
 *  the code to exactly that mobile-money channel. Returns the USSD string to
 *  show/dial in-app; the webhook — not this call — is what confirms the
 *  order once the customer actually dials and pays.
 *
 *  Safe to call again on the same intent: the live code is handed straight
 *  back, and once it has expired a genuinely NEW one is minted (a Monime code
 *  only lives ~15 minutes, so re-serving the old one would be a dead end).
 *  `expiresAt` is when the returned code stops working. */
export async function initMomoPayment(intentId: string, momoProvider: MomoProvider): Promise<{ ussdCode: string; expiresAt?: string }> {
  const { data, error } = await supabase.functions.invoke("payment-init", { body: { intentId, momoProvider } });
  if (error) throw error;
  return data;
}

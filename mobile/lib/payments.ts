import { supabase } from "./supabase";

/** Creates the actual Monime hosted-checkout session for a payment_intent
 *  fn_place_order already created (status='created'). Returns the URL to
 *  open in the browser; the webhook — not this call — is what confirms the
 *  order once the customer pays. */
export async function initMonimeCheckout(intentId: string): Promise<{ redirectUrl: string }> {
  const { data, error } = await supabase.functions.invoke("payment-init", { body: { intentId } });
  if (error) throw error;
  return data;
}

  // payment-init — creates the actual Monime hosted checkout session for a
  // payment_intent already inserted by fn_place_order (see the migration
  // 20260828162922_monime_checkout.sql and docs/08-payments-monime.md §8).
  //
  // The DB transaction that creates the order + payment_intent never talks to
  // Monime directly (no network calls inside a Postgres transaction) — this
  // Edge Function is that out-of-band step, called by the mobile app right
  // after placeOrder() returns a paymentIntentId.
  //
  // Auth: requires the caller's session JWT (see supabase/config.toml
  // [functions.payment-init] verify_jwt = true). We first read the intent
  // with a user-scoped client so RLS (`pi_own`) proves the caller owns it,
  // then switch to the service-role client only for the write.

  import { createClient } from "jsr:@supabase/supabase-js@2";

  const MONIME_API_BASE = "https://api.monime.io";
  const MONIME_VERSION = "caph.2025-08-23";

  // new Response(string) defaults to text/plain, which makes supabase-js's
  // functions.invoke() NOT parse the body as JSON — every response here must
  // be built through this so `data` on the client is a real object.
  function json(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }

  /** Required headers on every Monime API call (docs/08-payments-monime.md §0). */
  function monimeHeaders(accessToken: string, spaceId: string, idempotencyKey?: string): HeadersInit {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Monime-Space-Id": spaceId,
      "Monime-Version": MONIME_VERSION,
      "Content-Type": "application/json",
    };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    return headers;
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const MONIME_ACCESS_TOKEN = Deno.env.get("MONIME_ACCESS_TOKEN")!;
  const MONIME_SPACE_ID = Deno.env.get("MONIME_SPACE_ID")!;
  const MONIME_FINANCIAL_ACCOUNT_ID = Deno.env.get("MONIME_FINANCIAL_ACCOUNT_ID")!;
  const APP_SCHEME = "borteh";

  Deno.serve(async (req) => {
    if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

    let intentId: string | undefined;
    try {
      ({ intentId } = await req.json());
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    if (!intentId) return json({ error: "intentId required" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthenticated" }, 401);

    // User-scoped client: RLS proves the caller owns this intent (pi_own policy).
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: intent, error: intentErr } = await userClient
      .from("payment_intent")
      .select("id, order_id, provider, status, amount_minor, currency, provider_intent_id, redirect_url, idempotency_key")
      .eq("id", intentId)
      .maybeSingle();

    if (intentErr || !intent) {
      return json({ error: "intent_not_found" }, 404);
    }
    if (intent.provider !== "monime") {
      return json({ error: "not_a_monime_intent" }, 400);
    }

    // Idempotent re-entry: session already created (e.g. app backgrounded mid-flow).
    if (intent.provider_intent_id && intent.redirect_url) {
      return json({ redirectUrl: intent.redirect_url }, 200);
    }
    if (intent.status !== "created") {
      return json({ error: "intent_not_initializable", status: intent.status }, 409);
    }

    const { data: order, error: orderErr } = await userClient
      .from("order")
      .select("id, order_number")
      .eq("id", intent.order_id)
      .maybeSingle();

    if (orderErr || !order) {
      return json({ error: "order_not_found" }, 404);
    }

    // Deliberately ONE line item for the intent's own amount_minor — not a
    // reconstruction from order_item.unit_price_minor × qty. Those are
    // pre-discount per-unit snapshots; summing them ignores combo/tier/promo/
    // loyalty discounts already folded into order.total_minor (= amount_minor,
    // enforced by trg_intent_amount). Charging anything else guarantees an
    // AMOUNT_MISMATCH at the webhook — the payment-integrity guard doing
    // exactly its job, just against a wrong charge instead of real tampering.
    const lineItems = [
      { type: "custom", name: "Order total", quantity: 1, price: { currency: "SLE", value: intent.amount_minor } },
    ];

    // Distinct success/cancel URLs (rather than one shared URL) so the app can
    // tell "customer backed out" apart from "went through the flow" when the
    // browser closes — the webhook is still the only thing that actually
    // confirms the order, but this lets checkout avoid celebrating a cancel.
    const body = {
      name: order.order_number,
      successUrl: `${APP_SCHEME}://order/${order.id}?payment=success`,
      cancelUrl: `${APP_SCHEME}://order/${order.id}?payment=cancelled`,
      reference: order.id,
      callbackState: intent.id,
      financialAccountId: MONIME_FINANCIAL_ACCOUNT_ID,
      lineItems,
      metadata: { intent_id: intent.id, order_id: order.id },
    };

    const monimeRes = await fetch(`${MONIME_API_BASE}/v1/checkout-sessions`, {
      method: "POST",
      headers: monimeHeaders(MONIME_ACCESS_TOKEN, MONIME_SPACE_ID, intent.idempotency_key),
      body: JSON.stringify(body),
    });

    const monimeJson = await monimeRes.json().catch(() => null);
    if (!monimeRes.ok || !monimeJson?.result?.id || !monimeJson?.result?.redirectUrl) {
      console.error("monime checkout-session failed", monimeRes.status, monimeJson);
      return json({ error: "monime_checkout_failed" }, 502);
    }

    // Service-role client: payment_intent has no authenticated UPDATE policy by design.
    const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { error: updateErr } = await serviceClient
      .from("payment_intent")
      .update({
        provider_intent_id: monimeJson.result.id,
        redirect_url: monimeJson.result.redirectUrl,
        checkout_session_raw: monimeJson,
        callback_state: intent.id,
      })
      .eq("id", intent.id);

    if (updateErr) {
      console.error("failed to persist monime session", updateErr);
      return json({ error: "persist_failed" }, 500);
    }

    return json({ redirectUrl: monimeJson.result.redirectUrl }, 200);
  });

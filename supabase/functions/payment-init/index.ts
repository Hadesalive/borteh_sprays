// payment-init — creates a Monime Payment Code (USSD) for a payment_intent
// already inserted by fn_place_order (see migrations 20260828162922_monime_checkout.sql
// and 20260828230901_ussd_payment_codes.sql, docs/08-payments-monime.md §8).
// The customer dials the USSD code shown in-app themselves — no browser
// redirect.
//
// POST /v1/payment-codes was 500ing ("CROSSSLOT Keys in request don't hash
// to the same slot") for weeks — traced to the MONIME_ACCESS_TOKEN itself,
// not our space/account/payload: a freshly generated token fixed it
// instantly with everything else identical. Reported to Monime as a
// backend bug (a bad-scope/stale token should 403 cleanly here, the way it
// does on other endpoints, not throw a raw Redis error) — but functionally
// unblocked on our side by rotating the token.
//
// A Payment Code is only dialable for CODE_DURATION. "This intent already has
// a code" is therefore NOT a reason to skip Monime — past the code's expiry we
// mint a new one with a fresh Idempotency-Key, and re-anchor the stock hold to
// it (see 20260829115831_ussd_code_expiry.sql for why both halves matter).
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
const MOMO_PROVIDERS = new Set(["m17", "m18"]); // m17 = Orange Money, m18 = Afrimoney
const CODE_DURATION = "15m"; // how long the USSD code stays dialable
const CODE_DURATION_MS = 15 * 60 * 1000; // same, in ms — only used if Monime omits expireTime
// Don't hand back a code with seconds left on it; issue a fresh one instead.
const CODE_FRESHNESS_MARGIN_MS = 60 * 1000;
// The DB-side stock hold must OUTLIVE the provider's code, never the other way
// round: the 2026-08-29 incident was the sweep cancelling an order whose USSD
// code was still perfectly dialable. This grace also absorbs webhook latency
// on a payment dialed in the code's final seconds.
const RESERVATION_GRACE_MS = 5 * 60 * 1000;

// new Response(string) defaults to text/plain, which makes supabase-js's
// functions.invoke() NOT parse the body as JSON — every response here must
// be built through this so `data` on the client is a real object.
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Monime's Idempotency-Key is capped at 64 chars, and re-POSTing an OLD key
 *  returns the SAME (by then dead) payment code — so a genuine retry needs a
 *  genuinely new key. Bucketing by the minute keeps an accidental double-tap
 *  idempotent while guaranteeing freshness on a real retry minutes later. */
function retryIdempotencyKey(baseKey: string, now: number): string {
  const bucket = String(Math.floor(now / 60_000));
  const room = 64 - bucket.length - 1;
  return `${baseKey.length > room ? baseKey.slice(0, room) : baseKey}-${bucket}`;
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  let intentId: string | undefined;
  let momoProvider: string | undefined;
  try {
    ({ intentId, momoProvider } = await req.json());
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!intentId) return json({ error: "intentId required" }, 400);
  if (!momoProvider || !MOMO_PROVIDERS.has(momoProvider)) return json({ error: "invalid_momo_provider" }, 400);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthenticated" }, 401);

  // User-scoped client: RLS proves the caller owns this intent (pi_own policy).
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: intent, error: intentErr } = await userClient
    .from("payment_intent")
    .select("id, order_id, provider, status, amount_minor, currency, provider_intent_id, ussd_code, ussd_code_expires_at, idempotency_key")
    .eq("id", intentId)
    .maybeSingle();

  if (intentErr || !intent) {
    return json({ error: "intent_not_found" }, 404);
  }
  if (intent.provider !== "monime") {
    return json({ error: "not_a_monime_intent" }, 400);
  }
  if (intent.status !== "created" && intent.status !== "processing") {
    return json({ error: "intent_not_initializable", status: intent.status }, 409);
  }
  // A fully-discounted order never routes here — fn_place_order confirms it
  // outright rather than creating an intent — but refuse loudly if one does:
  // /v1/payment-codes is not documented to accept amount.value = 0, and a
  // "dial this to pay Le 0" screen is a dead end for the customer.
  if (!(intent.amount_minor > 0)) {
    return json({ error: "zero_amount_intent" }, 400);
  }

  // Idempotent re-entry — but ONLY while the stored code is still dialable.
  // A Payment Code dies after CODE_DURATION, and re-POSTing its original
  // Idempotency-Key just returns the same dead string, which is what made the
  // order screen's "Get a new code" button permanently useless. Past that
  // point we fall through and mint a genuinely new one.
  const codeExpiresAt = intent.ussd_code_expires_at ? Date.parse(intent.ussd_code_expires_at) : NaN;
  const codeStillLive = Number.isFinite(codeExpiresAt) && codeExpiresAt - Date.now() > CODE_FRESHNESS_MARGIN_MS;
  if (intent.provider_intent_id && intent.ussd_code && codeStillLive) {
    return json({ ussdCode: intent.ussd_code, expiresAt: intent.ussd_code_expires_at }, 200);
  }
  const isRetry = Boolean(intent.provider_intent_id || intent.ussd_code);

  const { data: order, error: orderErr } = await userClient
    .from("order")
    .select("id, order_number")
    .eq("id", intent.order_id)
    .maybeSingle();

  if (orderErr || !order) {
    return json({ error: "order_not_found" }, 404);
  }

  const body = {
    name: order.order_number,
    mode: "one_time",
    amount: { currency: "SLE", value: intent.amount_minor },
    duration: CODE_DURATION,
    authorizedProviders: [momoProvider],
    financialAccountId: MONIME_FINANCIAL_ACCOUNT_ID,
    reference: order.id,
    metadata: { intent_id: intent.id, order_id: order.id, momo_provider: momoProvider },
  };

  // First code for this intent reuses the stable key fn_place_order minted;
  // a retry MUST NOT (see retryIdempotencyKey).
  const idempotencyKey = isRetry ? retryIdempotencyKey(intent.idempotency_key, Date.now()) : intent.idempotency_key;

  const monimeRes = await fetch(`${MONIME_API_BASE}/v1/payment-codes`, {
    method: "POST",
    headers: monimeHeaders(MONIME_ACCESS_TOKEN, MONIME_SPACE_ID, idempotencyKey),
    body: JSON.stringify(body),
  });

  const monimeJson = await monimeRes.json().catch(() => null);
  if (!monimeRes.ok || !monimeJson?.result?.id || !monimeJson?.result?.ussdCode) {
    console.error("monime payment-code failed", monimeRes.status, monimeJson);
    return json({ error: "monime_payment_code_failed" }, 502);
  }

  // Monime's own expiry for THIS code is the authority; fall back to our
  // requested duration only if the response omits it.
  const providerExpiry = Date.parse(monimeJson.result.expireTime ?? "");
  const expiresAtMs = Number.isFinite(providerExpiry) ? providerExpiry : Date.now() + CODE_DURATION_MS;

  // Service-role client: payment_intent has no authenticated UPDATE policy by design.
  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { error: updateErr } = await serviceClient
    .from("payment_intent")
    .update({
      provider_intent_id: monimeJson.result.id, // pmc-...
      ussd_code: monimeJson.result.ussdCode,
      ussd_code_expires_at: new Date(expiresAtMs).toISOString(),
      // Re-anchor the stock hold to the code we just minted, so the sweep can
      // never cancel an order whose code is still dialable. fn_place_order's
      // 15 minutes started ticking at order placement, before this call
      // existed — that gap is what the 2026-08-29 incident fell through.
      // A customer tapping "Get a new code" extends the hold each time; that's
      // deliberate (staff can still cancel), and far better than the reverse.
      reservation_expires_at: new Date(expiresAtMs + RESERVATION_GRACE_MS).toISOString(),
      checkout_session_raw: monimeJson, // raw provider response, name predates this flow
      callback_state: intent.id,
    })
    .eq("id", intent.id);

  if (updateErr) {
    console.error("failed to persist monime payment code", updateErr);
    return json({ error: "persist_failed" }, 500);
  }

  return json({ ussdCode: monimeJson.result.ussdCode, expiresAt: new Date(expiresAtMs).toISOString() }, 200);
});

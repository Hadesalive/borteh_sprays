// monime-webhook — public endpoint (verify_jwt = false, see supabase/config.toml).
// Authenticity comes entirely from the Monime-Signature HMAC check below, not
// from a Supabase session. Follows docs/08-payments-monime.md §4/§1.5/§1.6 and
// the monime-integration skill's handler skeleton exactly:
//
//   raw body first -> verify HMAC -> dedup on event.id -> skip non-completion
//   events early -> match intent (metadata -> object_id -> ownership graph)
//   -> fn_confirm_monime_payment (amount/currency check + guarded flip, done
//   inside that SECURITY DEFINER function so it's one atomic transaction).
//
// checkout_session.expired is left informational (§6 of the skill): the
// pg_cron sweep (fn_expire_monime_intents) reclaims abandoned holds — no
// need to race it here.
//
// fn_confirm_monime_payment distinguishes 'already_processed' (a benign
// duplicate delivery) from 'late_on_dead_intent' (the customer really paid,
// but the sweep or staff had already killed the order) — see
// 20260829115411_late_monime_confirmation.sql. The second one is a real
// incident and gets filed into the refund queue, not swallowed.
//
// Rolled back to Payment Code (payment_code.completed) event handling —
// see payment-init/index.ts's header: the CROSSSLOT 500 that blocked
// /v1/payment-codes was traced to the access token, fixed by rotating it.
// matchIntentLocators below recognizes both `checkout_session` and
// `payment_code` object types so this file doesn't need touching again if
// the payment mechanism changes.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { matchIntentLocators, verifyMonimeWebhook } from "../_shared/monime-verify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET_CURRENT = Deno.env.get("MONIME_WEBHOOK_SECRET_CURRENT");
const WEBHOOK_SECRET_PREVIOUS = Deno.env.get("MONIME_WEBHOOK_SECRET_PREVIOUS");

const COMPLETION_EVENTS = new Set(["payment.completed", "payment.processing_completed", "payment_code.completed"]);

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  // (1) RAW body BEFORE any parse — load-bearing for the signature.
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("monime-signature"); // Headers already lowercases keys

  // (2)-(6) HMAC verify: underscore-joined payload, base64, timing-safe, two-secret rotation.
  const check = await verifyMonimeWebhook(rawBody, signatureHeader, [WEBHOOK_SECRET_CURRENT, WEBHOOK_SECRET_PREVIOUS]);
  if (!check.verified) {
    // (7) zero DB writes on a failed verification.
    return new Response("invalid signature", { status: 401 });
  }

  let evt: any;
  try {
    evt = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const eventId: string | undefined = evt?.event?.id;
  const eventType: string | undefined = evt?.event?.name;
  if (!eventId || !eventType) return new Response("malformed event", { status: 400 });

  // Dedup on (provider, provider_event_id) — no row back means already processed.
  const { data: inserted, error: insertErr } = await db
    .from("payment_webhook")
    .insert({
      provider: "monime",
      provider_event_id: eventId,
      event_type: eventType,
      signature_t: check.signatureT,
      raw_body: rawBody,
      payload: evt,
      verified: true,
    })
    .select("id")
    .single();

  if (insertErr) {
    // Unique-violation on provider_event_id == duplicate delivery; anything else is a real error.
    if (insertErr.code === "23505") return new Response("ok (duplicate)", { status: 200 });
    console.error("failed to record webhook", insertErr);
    return new Response("db error", { status: 500 });
  }
  const webhookId = inserted.id;

  if (!COMPLETION_EVENTS.has(eventType)) {
    await db.from("payment_webhook").update({ processed: true, processed_at: new Date().toISOString() }).eq("id", webhookId);
    return new Response("ok (non-completion)", { status: 200 });
  }

  const { metadataIntentId, objectId, ownershipChain } = matchIntentLocators(evt);
  let intentId: string | null = null;
  let matchMethod: string | null = null;

  if (metadataIntentId) {
    intentId = metadataIntentId;
    matchMethod = "metadata";
  } else if (objectId) {
    const { data } = await db.from("payment_intent").select("id").eq("provider_intent_id", objectId).maybeSingle();
    if (data) {
      intentId = data.id;
      matchMethod = "object_id";
    }
  } else {
    for (const candidate of ownershipChain) {
      const { data } = await db.from("payment_intent").select("id").eq("provider_intent_id", candidate).maybeSingle();
      if (data) {
        intentId = data.id;
        matchMethod = "ownership_graph";
        break;
      }
    }
  }

  if (!intentId) {
    await db.from("payment_webhook").update({ processed: true, processed_at: new Date().toISOString(), error: "NO_INTENT_MATCH" }).eq("id", webhookId);
    return new Response("ok (no intent match)", { status: 200 });
  }

  const eventAmount = Number(evt?.data?.amount?.value);
  const eventCurrency = evt?.data?.amount?.currency;
  if (!Number.isFinite(eventAmount) || !eventCurrency) {
    await db.from("payment_webhook").update({ payment_intent_id: intentId, match_method: matchMethod, processed: true, processed_at: new Date().toISOString(), error: "MISSING_AMOUNT" }).eq("id", webhookId);
    return new Response("ok (missing amount)", { status: 200 });
  }

  const { data: outcome, error: rpcErr } = await db.rpc("fn_confirm_monime_payment", {
    p_intent_id: intentId,
    p_event_amount: eventAmount,
    p_event_currency: eventCurrency,
  });

  if (rpcErr) {
    console.error("fn_confirm_monime_payment failed", rpcErr);
    await db.from("payment_webhook").update({ payment_intent_id: intentId, match_method: matchMethod, error: rpcErr.message }).eq("id", webhookId);
    return new Response("db error", { status: 500 });
  }

  // The customer's money moved, but the intent was already expired (cron sweep)
  // or cancelled (staff) — fn_confirm_monime_payment has filed it into the
  // refund queue (admin_payment_attention) for a human to resolve. Ack it:
  // a 500 would only make Monime redeliver an event nothing here can settle,
  // and the dedup would swallow every retry anyway.
  if (outcome === "late_on_dead_intent") {
    console.error("monime: LATE confirmation on an already-dead intent — flagged for refund review", { intentId, eventId, eventType });
    await db.from("payment_webhook").update({ payment_intent_id: intentId, match_method: matchMethod, processed: true, processed_at: new Date().toISOString(), error: "LATE_ON_DEAD_INTENT" }).eq("id", webhookId);
    return new Response("ok (late on dead intent — flagged for review)", { status: 200 });
  }

  if (outcome === "amount_mismatch") {
    await db.from("payment_webhook").update({ payment_intent_id: intentId, match_method: matchMethod, error: "AMOUNT_MISMATCH" }).eq("id", webhookId);
    // 500 so this surfaces for retry/manual review rather than being silently ack'd.
    return new Response("amount mismatch", { status: 500 });
  }

  await db.from("payment_webhook").update({ payment_intent_id: intentId, match_method: matchMethod, processed: true, processed_at: new Date().toISOString() }).eq("id", webhookId);
  return new Response("ok", { status: 200 });
});

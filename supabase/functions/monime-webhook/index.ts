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

import { createClient } from "jsr:@supabase/supabase-js@2";

// ---- inlined Monime HMAC verification (docs/08-payments-monime.md §4.1) ----
// The signed payload uses an UNDERSCORE — `t + "_" + rawBody` — not Stripe's
// period. Header lookup is case-insensitive (Deno's Headers already
// lowercases keys), and the raw body must be read before any JSON.parse.

const MAX_AGE_SECONDS = 300; // +300s past
const MAX_FUTURE_SECONDS = 60; // -60s future

interface SignatureCheck {
  verified: boolean;
  signatureT?: number;
}

function parseSignatureHeader(header: string): { t?: string; v1?: string } {
  const out: { t?: string; v1?: string } = {};
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") out.t = value;
    if (key === "v1") out.v1 = value;
  }
  return out;
}

function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacSha256(secret: string, payload: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return new Uint8Array(sig);
}

async function verifyMonimeWebhook(rawBody: string, signatureHeader: string | null, secrets: (string | undefined)[]): Promise<SignatureCheck> {
  if (!signatureHeader) return { verified: false };
  const { t, v1 } = parseSignatureHeader(signatureHeader);
  if (!t || !v1) return { verified: false };

  const tNum = Number(t);
  if (!Number.isFinite(tNum)) return { verified: false };
  const now = Math.floor(Date.now() / 1000);
  if (now - tNum > MAX_AGE_SECONDS) return { verified: false };
  if (tNum - now > MAX_FUTURE_SECONDS) return { verified: false };

  const expectedSig = base64ToBytes(v1);
  if (!expectedSig) return { verified: false };

  const signedPayload = `${t}_${rawBody}`; // UNDERSCORE — not Stripe's period
  for (const secret of secrets) {
    if (!secret) continue;
    const computed = await hmacSha256(secret, signedPayload);
    if (timingSafeEqual(computed, expectedSig)) {
      return { verified: true, signatureT: tNum };
    }
  }
  return { verified: false };
}

/** Walk data.metadata / data.channel.metadata / ownershipGraph to find our intent id or the scs- object id. */
function matchIntentLocators(evt: any): { metadataIntentId?: string; objectId?: string; ownershipChain: string[] } {
  const data = evt?.data ?? {};
  const dataMeta = data.metadata ?? {};
  const channelMeta = data.channel?.metadata ?? {};
  const metadataIntentId = (typeof dataMeta.intent_id === "string" && dataMeta.intent_id) || (typeof channelMeta.intent_id === "string" && channelMeta.intent_id) || undefined;

  const objectId = evt?.object?.type === "checkout_session" ? evt.object.id : undefined;

  const ownershipChain: string[] = [];
  let node = data.ownershipGraph?.owner;
  for (let depth = 0; node && depth < 5; depth++) {
    if (node.type === "checkout_session" && typeof node.id === "string") ownershipChain.push(node.id);
    node = node.owner;
  }

  return { metadataIntentId, objectId, ownershipChain };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET_CURRENT = Deno.env.get("MONIME_WEBHOOK_SECRET_CURRENT");
const WEBHOOK_SECRET_PREVIOUS = Deno.env.get("MONIME_WEBHOOK_SECRET_PREVIOUS");

const COMPLETION_EVENTS = new Set(["payment.completed", "payment.processing_completed"]);

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

  if (outcome === "amount_mismatch") {
    await db.from("payment_webhook").update({ payment_intent_id: intentId, match_method: matchMethod, error: "AMOUNT_MISMATCH" }).eq("id", webhookId);
    // 500 so this surfaces for retry/manual review rather than being silently ack'd.
    return new Response("amount mismatch", { status: 500 });
  }

  await db.from("payment_webhook").update({ payment_intent_id: intentId, match_method: matchMethod, processed: true, processed_at: new Date().toISOString() }).eq("id", webhookId);
  return new Response("ok", { status: 200 });
});

// Pure, testable Monime webhook logic shared between monime-webhook/index.ts
// and its Deno test file. Nothing here talks to Supabase or the network —
// that keeps it unit-testable without a running edge runtime.
//
// See docs/08-payments-monime.md §4.1 and the monime-integration skill for
// the spec this implements: signed payload is `${t}_${rawBody}` (UNDERSCORE,
// not Stripe's period), base64 HMAC-SHA256, ±replay window, two-secret
// rotation.

export const MAX_AGE_SECONDS = 300; // +300s past
export const MAX_FUTURE_SECONDS = 60; // -60s future

export interface SignatureCheck {
  verified: boolean;
  signatureT?: number;
}

export function parseSignatureHeader(header: string): { t?: string; v1?: string } {
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

export function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hmacSha256(secret: string, payload: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return new Uint8Array(sig);
}

export async function verifyMonimeWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secrets: (string | undefined)[],
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<SignatureCheck> {
  if (!signatureHeader) return { verified: false };
  const { t, v1 } = parseSignatureHeader(signatureHeader);
  if (!t || !v1) return { verified: false };

  const tNum = Number(t);
  if (!Number.isFinite(tNum)) return { verified: false };
  if (nowSeconds - tNum > MAX_AGE_SECONDS) return { verified: false };
  if (tNum - nowSeconds > MAX_FUTURE_SECONDS) return { verified: false };

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

/** Object types whose id can identify a payment_intent — covers both the
 *  checkout-session and payment-code payment mechanisms so this file
 *  doesn't need touching again if the payment mechanism changes. */
export const INTENT_OBJECT_TYPES = new Set(["checkout_session", "payment_code"]);

/** Walk data.metadata / data.channel.metadata / ownershipGraph to find our intent id or the scs-/pmc- object id. */
export function matchIntentLocators(evt: any): { metadataIntentId?: string; objectId?: string; ownershipChain: string[] } {
  const data = evt?.data ?? {};
  const dataMeta = data.metadata ?? {};
  const channelMeta = data.channel?.metadata ?? {};
  const metadataIntentId = (typeof dataMeta.intent_id === "string" && dataMeta.intent_id) || (typeof channelMeta.intent_id === "string" && channelMeta.intent_id) || undefined;

  const objectId = INTENT_OBJECT_TYPES.has(evt?.object?.type) ? evt.object.id : undefined;

  const ownershipChain: string[] = [];
  let node = data.ownershipGraph?.owner;
  for (let depth = 0; node && depth < 5; depth++) {
    if (INTENT_OBJECT_TYPES.has(node.type) && typeof node.id === "string") ownershipChain.push(node.id);
    node = node.owner;
  }

  return { metadataIntentId, objectId, ownershipChain };
}

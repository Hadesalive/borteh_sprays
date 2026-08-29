// Unit tests for monime-verify.ts — the HMAC verification and intent-matching
// logic monime-webhook/index.ts is built on. Pure functions, no network/DB,
// so these run under plain `deno test` with no local Supabase stack needed.
//
// Run:  deno test supabase/functions/_shared/monime-verify.test.ts

import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  base64ToBytes,
  hmacSha256,
  matchIntentLocators,
  MAX_AGE_SECONDS,
  MAX_FUTURE_SECONDS,
  parseSignatureHeader,
  timingSafeEqual,
  verifyMonimeWebhook,
} from "./monime-verify.ts";

const SECRET_CURRENT = "whsec_current_test_secret";
const SECRET_PREVIOUS = "whsec_previous_test_secret";

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Builds a real `t=...,v1=...` header for a given body/secret/timestamp — mirrors what Monime sends. */
async function sign(body: string, secret: string, t: number): Promise<string> {
  const sig = await hmacSha256(secret, `${t}_${body}`);
  return `t=${t},v1=${bytesToBase64(sig)}`;
}

// ---- parseSignatureHeader -------------------------------------------------

Deno.test("parseSignatureHeader: standard header", () => {
  const { t, v1 } = parseSignatureHeader("t=1700000000,v1=abc123==");
  assertEquals(t, "1700000000");
  assertEquals(v1, "abc123==");
});

Deno.test("parseSignatureHeader: tolerates whitespace around parts", () => {
  const { t, v1 } = parseSignatureHeader(" t=1700000000 , v1=abc123== ");
  assertEquals(t, "1700000000");
  assertEquals(v1, "abc123==");
});

Deno.test("parseSignatureHeader: missing v1", () => {
  const { t, v1 } = parseSignatureHeader("t=1700000000");
  assertEquals(t, "1700000000");
  assertEquals(v1, undefined);
});

Deno.test("parseSignatureHeader: garbage input yields empty fields", () => {
  const { t, v1 } = parseSignatureHeader("not-a-valid-header");
  assertEquals(t, undefined);
  assertEquals(v1, undefined);
});

// ---- timingSafeEqual -------------------------------------------------------

Deno.test("timingSafeEqual: equal bytes", () => {
  assert(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])));
});

Deno.test("timingSafeEqual: different content, same length", () => {
  assertFalse(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])));
});

Deno.test("timingSafeEqual: different length short-circuits false", () => {
  assertFalse(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2])));
});

// ---- base64ToBytes ----------------------------------------------------------

Deno.test("base64ToBytes: valid base64 round-trips", () => {
  const bytes = base64ToBytes(bytesToBase64(new Uint8Array([10, 20, 30])));
  assertEquals(bytes, new Uint8Array([10, 20, 30]));
});

Deno.test("base64ToBytes: invalid base64 returns null, not a throw", () => {
  assertEquals(base64ToBytes("not base64!!! @@@"), null);
});

// ---- verifyMonimeWebhook ----------------------------------------------------
// nowSeconds is passed explicitly so these are deterministic, not wall-clock-dependent.

Deno.test("verifyMonimeWebhook: valid signature with current secret verifies", async () => {
  const body = '{"event":{"id":"evt_1"}}';
  const t = 1_700_000_000;
  const header = await sign(body, SECRET_CURRENT, t);
  const result = await verifyMonimeWebhook(body, header, [SECRET_CURRENT, SECRET_PREVIOUS], t);
  assert(result.verified);
  assertEquals(result.signatureT, t);
});

Deno.test("verifyMonimeWebhook: falls back to previous secret during rotation", async () => {
  const body = '{"event":{"id":"evt_1"}}';
  const t = 1_700_000_000;
  const header = await sign(body, SECRET_PREVIOUS, t);
  const result = await verifyMonimeWebhook(body, header, [SECRET_CURRENT, SECRET_PREVIOUS], t);
  assert(result.verified, "a signature made with the previous (not-yet-expired) secret must still verify");
});

Deno.test("verifyMonimeWebhook: wrong secret entirely fails", async () => {
  const body = '{"event":{"id":"evt_1"}}';
  const t = 1_700_000_000;
  const header = await sign(body, "some_other_secret", t);
  const result = await verifyMonimeWebhook(body, header, [SECRET_CURRENT, SECRET_PREVIOUS], t);
  assertFalse(result.verified);
});

Deno.test("verifyMonimeWebhook: tampered body invalidates a signature made for the original body", async () => {
  const t = 1_700_000_000;
  const header = await sign('{"event":{"id":"evt_1"}}', SECRET_CURRENT, t);
  const result = await verifyMonimeWebhook('{"event":{"id":"evt_1","amount":999999}}', header, [SECRET_CURRENT], t);
  assertFalse(result.verified);
});

Deno.test("verifyMonimeWebhook: no signature header at all", async () => {
  const result = await verifyMonimeWebhook("{}", null, [SECRET_CURRENT], 1_700_000_000);
  assertFalse(result.verified);
});

Deno.test("verifyMonimeWebhook: malformed header (missing t or v1)", async () => {
  const result = await verifyMonimeWebhook("{}", "v1=onlyvalue==", [SECRET_CURRENT], 1_700_000_000);
  assertFalse(result.verified);
});

Deno.test("verifyMonimeWebhook: non-numeric t", async () => {
  const result = await verifyMonimeWebhook("{}", "t=not-a-number,v1=abc==", [SECRET_CURRENT], 1_700_000_000);
  assertFalse(result.verified);
});

Deno.test("verifyMonimeWebhook: replay window — just inside the past boundary verifies", async () => {
  const body = "{}";
  const t = 1_700_000_000;
  const now = t + MAX_AGE_SECONDS; // exactly at the boundary, not over it
  const header = await sign(body, SECRET_CURRENT, t);
  const result = await verifyMonimeWebhook(body, header, [SECRET_CURRENT], now);
  assert(result.verified, "a signature exactly at the max-age boundary should still verify");
});

Deno.test("verifyMonimeWebhook: replay window — just past the boundary is rejected", async () => {
  const body = "{}";
  const t = 1_700_000_000;
  const now = t + MAX_AGE_SECONDS + 1; // one second too old
  const header = await sign(body, SECRET_CURRENT, t);
  const result = await verifyMonimeWebhook(body, header, [SECRET_CURRENT], now);
  assertFalse(result.verified, "a signature one second past max-age must be rejected (replay protection)");
});

Deno.test("verifyMonimeWebhook: clock skew — exactly at the allowed future skew still verifies", async () => {
  const body = "{}";
  const now = 1_700_000_000;
  const t = now + MAX_FUTURE_SECONDS; // exactly at the boundary, not over it
  const header = await sign(body, SECRET_CURRENT, t);
  const result = await verifyMonimeWebhook(body, header, [SECRET_CURRENT], now);
  assert(result.verified, "a signature exactly at the future-skew boundary should still verify");
});

Deno.test("verifyMonimeWebhook: clock skew — timestamp too far in the future is rejected", async () => {
  const body = "{}";
  const now = 1_700_000_000;
  const t = now + MAX_FUTURE_SECONDS + 1; // one second past the allowed future skew
  const header = await sign(body, SECRET_CURRENT, t);
  const result = await verifyMonimeWebhook(body, header, [SECRET_CURRENT], now);
  assertFalse(result.verified);
});

Deno.test("verifyMonimeWebhook: no secrets configured at all", async () => {
  const body = "{}";
  const t = 1_700_000_000;
  const header = await sign(body, SECRET_CURRENT, t);
  const result = await verifyMonimeWebhook(body, header, [undefined, undefined], t);
  assertFalse(result.verified);
});

// ---- matchIntentLocators -----------------------------------------------------

Deno.test("matchIntentLocators: top-level data.metadata.intent_id wins", () => {
  const { metadataIntentId } = matchIntentLocators({ data: { metadata: { intent_id: "intent-a" } } });
  assertEquals(metadataIntentId, "intent-a");
});

Deno.test("matchIntentLocators: falls back to data.channel.metadata.intent_id", () => {
  const { metadataIntentId } = matchIntentLocators({ data: { channel: { metadata: { intent_id: "intent-b" } } } });
  assertEquals(metadataIntentId, "intent-b");
});

Deno.test("matchIntentLocators: object.type checkout_session yields objectId", () => {
  const { objectId } = matchIntentLocators({ object: { type: "checkout_session", id: "scs-123" } });
  assertEquals(objectId, "scs-123");
});

Deno.test("matchIntentLocators: object.type payment_code yields objectId", () => {
  const { objectId } = matchIntentLocators({ object: { type: "payment_code", id: "pmc-123" } });
  assertEquals(objectId, "pmc-123");
});

Deno.test("matchIntentLocators: unrelated object.type (e.g. financial_transaction) yields no objectId", () => {
  const { objectId } = matchIntentLocators({ object: { type: "financial_transaction", id: "ftx-123" } });
  assertEquals(objectId, undefined);
});

Deno.test("matchIntentLocators: ownership graph walk finds a payment_code ancestor", () => {
  const evt = {
    object: { type: "financial_transaction", id: "ftx-1" },
    data: {
      ownershipGraph: {
        owner: { type: "payment", id: "pay-1", owner: { type: "payment_code", id: "pmc-999" } },
      },
    },
  };
  const { ownershipChain } = matchIntentLocators(evt);
  assertEquals(ownershipChain, ["pmc-999"]);
});

Deno.test("matchIntentLocators: ownership graph walk stops at depth 5", () => {
  // The tightest possible miss: the match sits at index 5, the FIRST node the
  // walk does not visit. Anything further out would also pass with an
  // off-by-one cutoff, so it wouldn't pin the boundary. Paired with the
  // index-4 hit below, these two bracket the exact limit.
  const target: any = { type: "checkout_session", id: "scs-at-depth-5" };
  let owner: any = target;
  for (let i = 4; i >= 0; i--) owner = { type: "other", id: `n${i}`, owner };
  const evt = { data: { ownershipGraph: { owner } } };
  const { ownershipChain } = matchIntentLocators(evt);
  assertEquals(ownershipChain, [], "a match at index 5 — one hop past the cutoff — must not be returned");
});

Deno.test("matchIntentLocators: ownership graph finds a match exactly at the last checked depth (index 4)", () => {
  const target = { type: "payment_code", id: "pmc-at-depth-4" };
  const n3 = { type: "other", id: "n3", owner: target };
  const n2 = { type: "other", id: "n2", owner: n3 };
  const n1 = { type: "other", id: "n1", owner: n2 };
  const n0 = { type: "other", id: "n0", owner: n1 };
  const evt = { data: { ownershipGraph: { owner: n0 } } };
  const { ownershipChain } = matchIntentLocators(evt);
  assertEquals(ownershipChain, ["pmc-at-depth-4"], "a match at the 5th visited node (index 4) must still be found");
});

Deno.test("matchIntentLocators: nothing matches anywhere", () => {
  const result = matchIntentLocators({ object: { type: "financial_transaction", id: "ftx-1" }, data: {} });
  assertEquals(result.metadataIntentId, undefined);
  assertEquals(result.objectId, undefined);
  assertEquals(result.ownershipChain, []);
});

Deno.test("matchIntentLocators: tolerates a completely empty event", () => {
  const result = matchIntentLocators({});
  assertEquals(result.metadataIntentId, undefined);
  assertEquals(result.objectId, undefined);
  assertEquals(result.ownershipChain, []);
});

// Tests the pure logic of the webhook that Monime ACTUALLY calls.
//
// This file exists because of a real incident. For a full day, fixes were being
// shipped to `monime-webhook` while Monime's dashboard pointed at
// `monime-webhook-` (trailing hyphen). A test suite sat next to the first one,
// passing 31 checks against code that received zero traffic — the tests were
// green and the production behaviour was wrong. Testing the wrong artifact is
// indistinguishable from not testing at all, and it is more dangerous, because
// it feels like coverage.
//
// So this suite reads the deployed entry point and evaluates its pure region —
// everything above the `Deno.serve(...)` call, minus the imports and the env
// reads. If that file is edited, this tests the edit. It cannot silently drift
// onto a copy, because there is no copy.
//
// Run:  deno test --allow-read supabase/tests/monime_webhook_verify.test.ts

import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";

const ENTRY = new URL("../functions/monime-webhook-/index.ts", import.meta.url);

/** Slice out the side-effect-free part of the live handler and import it. */
async function loadLiveLogic() {
  const src = await Deno.readTextFile(ENTRY);
  const cut = src.indexOf("Deno.serve(");
  assert(cut > 0, "Deno.serve( not found — the handler's shape changed, update this loader");
  const pure = src
    .slice(0, cut)
    .split("\n")
    .filter((l) => !l.startsWith("import ") && !l.includes("Deno.env.get") && !l.includes("createClient("))
    .join("\n");
  const exported = `${pure}
export { COMPLETION_EVENTS, MAX_AGE_SECONDS, MAX_FUTURE_SECONDS, hmacSha256,
         matchIntentLocators, parseSignatureHeader, paymentCodeRef,
         timingSafeEqual, verifyMonimeWebhook };`;
  return await import(`data:application/typescript,${encodeURIComponent(exported)}`);
}

const L = await loadLiveLogic();

const CURRENT = "whsec_current_test_secret";
const PREVIOUS = "whsec_previous_test_secret";
const b64 = (b: Uint8Array) => { let s = ""; for (const x of b) s += String.fromCharCode(x); return btoa(s); };
const sign = async (body: string, secret: string, t: number) =>
  `t=${t},v1=${b64(await L.hmacSha256(secret, `${t}_${body}`))}`;
const now = () => Math.floor(Date.now() / 1000);

// ---- signature verification ------------------------------------------------

Deno.test("verifies a correctly signed payload", async () => {
  const body = '{"event":{"id":"wkd-1","name":"payment_code.completed"}}';
  const t = now();
  assert((await L.verifyMonimeWebhook(body, await sign(body, CURRENT, t), [CURRENT, PREVIOUS])).verified);
});

Deno.test("a PERIOD separator does not verify — Monime uses an underscore", async () => {
  // the single most common way to get this integration wrong
  const body = "{}"; const t = now();
  const wrong = `t=${t},v1=${b64(await L.hmacSha256(CURRENT, `${t}.${body}`))}`;
  assertFalse((await L.verifyMonimeWebhook(body, wrong, [CURRENT])).verified);
});

Deno.test("falls back to the previous secret mid-rotation", async () => {
  const body = "{}"; const t = now();
  assert((await L.verifyMonimeWebhook(body, await sign(body, PREVIOUS, t), [CURRENT, PREVIOUS])).verified);
});

Deno.test("rejects a wrong secret, a tampered body, and junk headers", async () => {
  const t = now();
  assertFalse((await L.verifyMonimeWebhook("{}", await sign("{}", "nope", t), [CURRENT])).verified);
  assertFalse((await L.verifyMonimeWebhook('{"amount":99000}', await sign('{"amount":190}', CURRENT, t), [CURRENT])).verified);
  assertFalse((await L.verifyMonimeWebhook("{}", null, [CURRENT])).verified);
  assertFalse((await L.verifyMonimeWebhook("{}", "v1=only", [CURRENT])).verified);
  assertFalse((await L.verifyMonimeWebhook("{}", "t=abc,v1=zz", [CURRENT])).verified);
});

Deno.test("rejects replays and far-future timestamps", async () => {
  const body = "{}"; const n = now();
  // the live verifier reads its own clock, so these sit clear of the boundary
  assert((await L.verifyMonimeWebhook(body, await sign(body, CURRENT, n - L.MAX_AGE_SECONDS + 3), [CURRENT])).verified);
  assertFalse((await L.verifyMonimeWebhook(body, await sign(body, CURRENT, n - L.MAX_AGE_SECONDS - 5), [CURRENT])).verified);
  assert((await L.verifyMonimeWebhook(body, await sign(body, CURRENT, n + L.MAX_FUTURE_SECONDS - 3), [CURRENT])).verified);
  assertFalse((await L.verifyMonimeWebhook(body, await sign(body, CURRENT, n + L.MAX_FUTURE_SECONDS + 10), [CURRENT])).verified);
});

Deno.test("rejects everything when no secret is configured", async () => {
  const body = "{}"; const t = now();
  assertFalse((await L.verifyMonimeWebhook(body, await sign(body, CURRENT, t), [undefined, undefined])).verified);
});

Deno.test("compares in constant time and tolerates spaced headers", () => {
  assertFalse(L.timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3])));
  assert(L.timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])));
  assertFalse(L.timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])));
  assertEquals(L.parseSignatureHeader("t=123, v1=abc=="), { t: "123", v1: "abc==" });
});

// ---- which events confirm an order -----------------------------------------

Deno.test("all three completion events are recognised", () => {
  // recognising only payment_code.completed is what hid the channel data and
  // would have left a payment.completed-only rail permanently unconfirmed
  for (const e of ["payment.completed", "payment.processing_completed", "payment_code.completed"]) {
    assert(L.COMPLETION_EVENTS.has(e), `${e} must confirm`);
  }
});

Deno.test("informational events never confirm an order", () => {
  for (const e of ["payment.created", "payment.processing_started", "payment_code.expired",
                   "payment_code.processed", "financial_account.credited", "payout.completed"]) {
    assertFalse(L.COMPLETION_EVENTS.has(e), `${e} must not confirm`);
  }
});

// ---- intent matching --------------------------------------------------------

Deno.test("matches an intent from metadata, and by payment_code object id", () => {
  const id = "739d6786-fb7e-45ab-b137-7ea45fe4ca89";
  assertEquals(L.matchIntentLocators({ data: { metadata: { intent_id: id } } }).metadataIntentId, id);
  assertEquals(L.matchIntentLocators({ object: { id: "pmc-x", type: "payment_code" }, data: {} }).objectId, "pmc-x");
  assertEquals(L.matchIntentLocators({ object: { id: "ftx-1", type: "financial_transaction" }, data: {} }).objectId, undefined);
  assertEquals(L.matchIntentLocators({}).metadataIntentId, undefined);
});

// ---- duplicate vs redelivery ------------------------------------------------

Deno.test("both events of ONE payment resolve to the same code id", () => {
  // if these ever disagree, every ordinary payment is flagged as a duplicate
  // of itself and staff get told the customer was charged twice
  const PMC = "pmc-k6UP4QbKCFFRXVATZFeiAuyVRbf";
  const codeEvt = { object: { id: PMC, type: "payment_code" }, data: {} };
  const payEvt = { object: { id: "spm-k6UNXPpAd2Za6qPiuHF5qYmSEFC", type: "payment" },
                   data: { ownershipGraph: { owner: { id: PMC, type: "payment_code", owner: null } } } };
  assertEquals(L.paymentCodeRef(codeEvt), PMC);
  assertEquals(L.paymentCodeRef(payEvt), PMC);
  assertEquals(L.paymentCodeRef(codeEvt), L.paymentCodeRef(payEvt));
});

Deno.test("distinct codes stay distinct, and a payment id is never mistaken for one", () => {
  assert(L.paymentCodeRef({ object: { id: "pmc-AAA", type: "payment_code" }, data: {} }) !==
         L.paymentCodeRef({ object: { id: "pmc-BBB", type: "payment_code" }, data: {} }));
  assertEquals(L.paymentCodeRef({ object: { id: "spm-only", type: "payment" }, data: {} }), null);
});

Deno.test("walks a deeper ownership chain to find the code", () => {
  const PMC = "pmc-deep";
  assertEquals(L.paymentCodeRef({ object: { id: "ftx-1", type: "financial_transaction" },
    data: { ownershipGraph: { owner: { id: "spm-1", type: "payment",
            owner: { id: PMC, type: "payment_code", owner: null } } } } }), PMC);
});

Deno.test("returns null rather than guessing, and survives a cyclic graph", () => {
  assertEquals(L.paymentCodeRef({}), null);
  assertEquals(L.paymentCodeRef({ object: { type: "payment_code" } }), null);
  const node: Record<string, unknown> = { id: "x", type: "other" };
  node.owner = node;
  assertEquals(L.paymentCodeRef({ data: { ownershipGraph: { owner: node } } }), null);
});

import { describe, it, expect, vi } from "vitest";
import { listOrders, getMonimeChannels, getPaymentsNeedingAttention, PAGE_SIZE } from "@/lib/queries/orders";

/** Minimal fake of the Supabase query builder, recording what was called. */
function fakeDb(rows: unknown[] = [], count = 0) {
  const calls: Record<string, unknown[]> = {};
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "order", "range", "in", "eq", "limit"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls[method] = args;
      return builder;
    });
  }
  // Awaiting the builder resolves to the Supabase response shape.
  (builder as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve({ data: rows, count, error: null });
  return { db: { from: vi.fn(() => builder) }, calls };
}

describe("listOrders", () => {
  it("bounds the query with .range()", async () => {
    const { db, calls } = fakeDb();
    await listOrders(db as never, { page: 0, pageSize: PAGE_SIZE });
    expect(calls.range).toEqual([0, PAGE_SIZE - 1]);
  });

  it("offsets by page", async () => {
    const { db, calls } = fakeDb();
    await listOrders(db as never, { page: 2, pageSize: 50 });
    expect(calls.range).toEqual([100, 149]);
  });

  it("never issues an unbounded select", async () => {
    const { db, calls } = fakeDb();
    await listOrders(db as never, { page: 0, pageSize: 50 });
    expect(calls.range).toBeDefined();
  });

  it("returns the total row count for pagination", async () => {
    const { db } = fakeDb([{ id: "a" }], 3000);
    const result = await listOrders(db as never, { page: 0, pageSize: 50 });
    expect(result.total).toBe(3000);
    expect(result.rows).toHaveLength(1);
  });
});

/** One payment_intent row as the nested select returns it. */
function intentRow(orderId: string, webhooks: unknown[]) {
  return { order_id: orderId, payment_webhook: webhooks };
}

describe("getMonimeChannels", () => {
  const momo = { type: "momo", provider: "m17", phoneNumber: "+23277000000" };

  it("reads the channel off a payment_code.completed webhook (the live USSD flow)", async () => {
    const { db } = fakeDb([
      intentRow("o1", [{ processed: true, event_type: "payment_code.completed", payload: { data: { channel: momo } } }]),
    ]);
    const map = await getMonimeChannels(db as never, ["o1"]);
    expect(map.get("o1")).toEqual(momo);
  });

  it("still reads the older payment.completed / payment.processing_completed shapes", async () => {
    const { db } = fakeDb([
      intentRow("o1", [{ processed: true, event_type: "payment.completed", payload: { data: { channel: momo } } }]),
      intentRow("o2", [{ processed: true, event_type: "payment.processing_completed", payload: { data: { channel: momo } } }]),
    ]);
    const map = await getMonimeChannels(db as never, ["o1", "o2"]);
    expect(map.get("o1")).toEqual(momo);
    expect(map.get("o2")).toEqual(momo);
  });

  // A real payment_code.completed payload (order BS-2026-000043) — no channel
  // object at all, but the provider is still recoverable from what we set.
  it("derives the rail from metadata.momo_provider when payment_code.completed carries no channel", async () => {
    const { db } = fakeDb([
      intentRow("o1", [
        {
          processed: true,
          event_type: "payment_code.completed",
          payload: { data: { channel: undefined, processedPaymentData: null, metadata: { momo_provider: "m17" }, authorizedProviders: ["m17"] } },
        },
      ]),
    ]);
    const map = await getMonimeChannels(db as never, ["o1"]);
    expect(map.get("o1")).toEqual({ type: "momo", provider: "m17" });
  });

  it("derives the rail from a single authorizedProviders entry when metadata is absent", async () => {
    const { db } = fakeDb([
      intentRow("o1", [{ processed: true, event_type: "payment_code.completed", payload: { data: { authorizedProviders: ["m18"] } } }]),
    ]);
    const map = await getMonimeChannels(db as never, ["o1"]);
    expect(map.get("o1")).toEqual({ type: "momo", provider: "m18" });
  });

  it("does not guess when a payment code allowed more than one provider", async () => {
    const { db } = fakeDb([
      intentRow("o1", [{ processed: true, event_type: "payment_code.completed", payload: { data: { authorizedProviders: ["m17", "m18"] } } }]),
    ]);
    const map = await getMonimeChannels(db as never, ["o1"]);
    expect(map.has("o1")).toBe(false);
  });

  it("prefers Monime's own channel object over the derived one", async () => {
    const { db } = fakeDb([
      intentRow("o1", [
        { processed: true, event_type: "payment.processing_completed", payload: { data: { channel: momo, metadata: { momo_provider: "m18" } } } },
      ]),
    ]);
    const map = await getMonimeChannels(db as never, ["o1"]);
    expect(map.get("o1")).toEqual(momo);
  });

  it("skips a completion webhook that carries nothing usable at all", async () => {
    const { db } = fakeDb([
      intentRow("o1", [{ processed: true, event_type: "payment_code.completed", payload: { data: {} } }]),
    ]);
    const map = await getMonimeChannels(db as never, ["o1"]);
    expect(map.has("o1")).toBe(false);
  });

  it("ignores unprocessed and non-completion events", async () => {
    const { db } = fakeDb([
      intentRow("o1", [
        { processed: false, event_type: "payment_code.completed", payload: { data: { channel: momo } } },
        { processed: true, event_type: "payment_code.expired", payload: { data: { channel: momo } } },
      ]),
    ]);
    const map = await getMonimeChannels(db as never, ["o1"]);
    expect(map.has("o1")).toBe(false);
  });

  it("does not query at all for an empty order list", async () => {
    const { db } = fakeDb();
    const map = await getMonimeChannels(db as never, []);
    expect(map.size).toBe(0);
    expect(db.from).not.toHaveBeenCalled();
  });
});

describe("getPaymentsNeedingAttention", () => {
  it("returns the queued exceptions oldest-first and bounded", async () => {
    const row = {
      refund_id: "r1", order_id: "o1", order_number: "BS-2026-000043", order_status: "cancelled",
      intent_status: "expired", amount_minor: 19000, currency: "SLE",
      reason: "late_monime_confirmation", notes: "…", requested_at: "2026-08-29T10:00:00Z",
    };
    const { db, calls } = fakeDb([row]);
    const rows = await getPaymentsNeedingAttention(db as never);
    expect(rows).toEqual([row]);
    expect(calls.order).toEqual(["requested_at", { ascending: true }]);
    expect(calls.limit).toEqual([20]);
  });
});

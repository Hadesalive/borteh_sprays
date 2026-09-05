import { describe, it, expect, vi } from "vitest";
import { listCustomers, getBlockedCustomerCount, PAGE_SIZE } from "@/lib/queries/customers";

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

describe("listCustomers", () => {
  it("bounds the query with .range()", async () => {
    const { db, calls } = fakeDb();
    await listCustomers(db as never, { page: 0, pageSize: PAGE_SIZE });
    expect(calls.range).toEqual([0, PAGE_SIZE - 1]);
  });

  it("offsets by page", async () => {
    const { db, calls } = fakeDb();
    await listCustomers(db as never, { page: 2, pageSize: 50 });
    expect(calls.range).toEqual([100, 149]);
  });

  it("never issues an unbounded select", async () => {
    const { db, calls } = fakeDb();
    await listCustomers(db as never, { page: 0, pageSize: 50 });
    expect(calls.range).toBeDefined();
  });

  it("returns the total row count for pagination", async () => {
    const { db } = fakeDb([{ id: "a" }], 3000);
    const result = await listCustomers(db as never, { page: 0, pageSize: 50 });
    expect(result.total).toBe(3000);
    expect(result.rows).toHaveLength(1);
  });
});

describe("getBlockedCustomerCount", () => {
  it("uses a head-only count query, not a row fetch", async () => {
    const { db, calls } = fakeDb([], 4);
    const total = await getBlockedCustomerCount(db as never);
    expect(total).toBe(4);
    expect(calls.select).toEqual(["id", { count: "exact", head: true }]);
    expect(calls.eq).toEqual(["is_blocked", true]);
  });
});

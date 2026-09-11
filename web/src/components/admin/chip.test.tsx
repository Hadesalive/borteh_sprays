import { describe, it, expect } from "vitest";
import { statusTone, humanize } from "@/components/admin/chip";

describe("statusTone", () => {
  // Every status the order table's CHECK constraint allows must map to a tone
  // deliberately — an unmapped one silently renders neutral grey, which is how
  // pending_payment orders went unnoticed on Orders and the Dashboard.
  const ORDER_STATUSES = [
    "pending_payment",
    "confirmed",
    "preparing",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "returned",
  ] as const;

  it("maps every order status to something other than the neutral fallback", () => {
    for (const status of ORDER_STATUSES) {
      expect(statusTone(status), `${status} fell through to the fallback`).not.toBe("neutral");
    }
  });

  it("flags an unpaid order as needing attention", () => {
    expect(statusTone("pending_payment")).toBe("warning");
  });

  it("reads terminal states correctly", () => {
    expect(statusTone("delivered")).toBe("success");
    expect(statusTone("cancelled")).toBe("danger");
    expect(statusTone("returned")).toBe("danger");
  });

  it("falls back to neutral for anything unknown", () => {
    expect(statusTone("wat")).toBe("neutral");
  });
});

describe("humanize", () => {
  it("turns a snake_case status into a label", () => {
    expect(humanize("out_for_delivery")).toBe("Out For Delivery");
    expect(humanize("delivered")).toBe("Delivered");
  });
});

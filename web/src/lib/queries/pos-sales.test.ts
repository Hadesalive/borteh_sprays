import { describe, it, expect } from "vitest";
import { summarizeTill } from "@/lib/queries/pos-sales";

describe("summarizeTill", () => {
  it("splits completed sales by tender and counts voids separately", () => {
    const stats = summarizeTill([
      { payment_method: "cash", total_minor: 450, status: "completed" },
      { payment_method: "mobile_money", total_minor: 300, status: "completed" },
      { payment_method: "cash", total_minor: 200, status: "voided" },
    ]);
    expect(stats).toEqual({ receipts: 2, total_minor: 750, cash_minor: 450, mobile_money_minor: 300, voided: 1 });
  });

  it("is all zeros for an empty day", () => {
    expect(summarizeTill([])).toEqual({ receipts: 0, total_minor: 0, cash_minor: 0, mobile_money_minor: 0, voided: 0 });
  });
});

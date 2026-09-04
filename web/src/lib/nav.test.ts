import { describe, it, expect } from "vitest";
import { badgeCountFor, type BadgeCounts } from "@/lib/nav";

const counts: BadgeCounts = { pending_count: 6, low_stock_count: 3, out_of_stock_count: 1, out_for_delivery_count: 2 };

describe("badgeCountFor", () => {
  it("returns pending_count for Orders", () => {
    expect(badgeCountFor("/orders", counts)).toBe(6);
  });

  it("returns low_stock_count + out_of_stock_count for Inventory", () => {
    expect(badgeCountFor("/inventory", counts)).toBe(4);
  });

  it("returns out_for_delivery_count for Dispatch", () => {
    expect(badgeCountFor("/dispatch", counts)).toBe(2);
  });

  it("returns undefined for a route with no badge, so the badge doesn't render at all", () => {
    expect(badgeCountFor("/products", counts)).toBeUndefined();
  });

  it("returns undefined instead of 0, so an empty queue shows no badge rather than a badge reading 0", () => {
    const zero: BadgeCounts = { pending_count: 0, low_stock_count: 0, out_of_stock_count: 0, out_for_delivery_count: 0 };
    expect(badgeCountFor("/orders", zero)).toBeUndefined();
  });
});

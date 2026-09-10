import { describe, it, expect } from "vitest";
import { cartTotals, manualDiscountMinor } from "@/lib/pos-cart";

describe("manualDiscountMinor", () => {
  it("reads a Leone amount as minor units", () => {
    expect(manualDiscountMinor("10", "amount", 100_00)).toBe(10_00);
    expect(manualDiscountMinor("10.50", "amount", 100_00)).toBe(10_50);
  });

  it("takes a percentage of the base", () => {
    expect(manualDiscountMinor("10", "percent", 100_00)).toBe(10_00);
    expect(manualDiscountMinor("12.5", "percent", 100_00)).toBe(12_50);
  });

  it("never exceeds the base, whichever mode", () => {
    expect(manualDiscountMinor("999", "amount", 50_00)).toBe(50_00);
    expect(manualDiscountMinor("150", "percent", 50_00)).toBe(50_00);
  });

  it("treats half-typed and nonsense input as no discount", () => {
    for (const raw of ["", " ", ".", "-5", "abc", "0", "1e3", "5%", "Le 5"]) {
      expect(manualDiscountMinor(raw, "amount", 100_00)).toBe(0);
    }
  });

  it("accepts the shapes a cashier actually types", () => {
    expect(manualDiscountMinor("5", "amount", 100_00)).toBe(5_00);
    expect(manualDiscountMinor(".5", "amount", 100_00)).toBe(50);
    expect(manualDiscountMinor("5.", "amount", 100_00)).toBe(5_00); // mid-typing
    expect(manualDiscountMinor(" 5 ", "amount", 100_00)).toBe(5_00);
  });

  it("is zero when there is nothing left to discount", () => {
    expect(manualDiscountMinor("10", "percent", 0)).toBe(0);
  });
});

describe("cartTotals", () => {
  it("applies the manual discount after combo deals", () => {
    // 100 subtotal, 20 off from a deal, then 10% of the remaining 80.
    expect(cartTotals({ subtotal: 100_00, comboSavings: 20_00, discountRaw: "10", discountMode: "percent" })).toEqual({
      subtotal: 100_00,
      comboDiscount: 20_00,
      manualDiscount: 8_00,
      discount: 28_00,
      total: 72_00,
    });
  });

  it("never lets the total go below zero", () => {
    const t = cartTotals({ subtotal: 30_00, comboSavings: 20_00, discountRaw: "999", discountMode: "amount" });
    expect(t.discount).toBe(30_00);
    expect(t.total).toBe(0);
  });

  it("clamps combo savings that exceed the subtotal", () => {
    const t = cartTotals({ subtotal: 10_00, comboSavings: 99_00, discountRaw: "", discountMode: "amount" });
    expect(t.comboDiscount).toBe(10_00);
    expect(t.total).toBe(0);
  });

  it("is a plain subtotal with no deals and no discount", () => {
    expect(cartTotals({ subtotal: 45_00, comboSavings: 0, discountRaw: "", discountMode: "amount" })).toEqual({
      subtotal: 45_00,
      comboDiscount: 0,
      manualDiscount: 0,
      discount: 0,
      total: 45_00,
    });
  });
});

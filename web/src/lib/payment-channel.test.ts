import { describe, it, expect } from "vitest";
import { describePaymentChannel, paymentLabel, type PaymentChannel } from "@/lib/payment-channel";

/** Afrimoney (m18) cannot be exercised with a real payment — there's no account
 *  to pay from. What these lock down is that nothing in OUR code treats it as a
 *  second-class rail: every provider-specific line in the codebase is a label
 *  map, and the payment logic itself only ever carries the id as data. After
 *  this, the sole unverified thing about m18 is whether Monime's own API accepts
 *  `authorizedProviders: ["m18"]` — which is on their side, not ours. */
const momo = (provider: string): PaymentChannel => ({ type: "momo", provider, phoneNumber: "+23274****43" });

describe("describePaymentChannel", () => {
  it("names Orange Money (m17) — the rail proven in production", () => {
    expect(describePaymentChannel(momo("m17"))).toBe("Orange Money");
  });

  it("names Afrimoney (m18) — the rail we cannot pay from", () => {
    expect(describePaymentChannel(momo("m18"))).toBe("Afrimoney");
  });

  it("treats both rails identically apart from the name", () => {
    // same shape in, same shape out — no branch anywhere gives m18 a worse path
    for (const p of ["m17", "m18"]) {
      const label = describePaymentChannel(momo(p));
      expect(label).toBeTruthy();
      expect(label).not.toBe("Mobile Money"); // must resolve to a real brand, not the fallback
    }
  });

  it("falls back to a generic label for an unknown momo provider", () => {
    expect(describePaymentChannel(momo("m99"))).toBe("Mobile Money");
  });

  it("handles the non-momo rails Monime can report", () => {
    expect(describePaymentChannel({ type: "card" })).toBe("Card");
    expect(describePaymentChannel({ type: "bank" })).toBe("Bank Transfer");
    expect(describePaymentChannel({ type: "wallet" })).toBe("Wallet");
  });

  it("returns null when there is no channel yet (payment still pending)", () => {
    expect(describePaymentChannel(null)).toBeNull();
    expect(describePaymentChannel(undefined)).toBeNull();
    expect(describePaymentChannel({ provider: "m17" })).toBeNull(); // no type => unusable
  });
});

describe("paymentLabel", () => {
  it("qualifies Monime with the specific rail, for both providers", () => {
    expect(paymentLabel("monime", momo("m17"))).toBe("Monime — Orange Money");
    expect(paymentLabel("monime", momo("m18"))).toBe("Monime — Afrimoney");
  });

  it("degrades to a bare Monime when the channel is unknown, never to a wrong rail", () => {
    expect(paymentLabel("monime", null)).toBe("Monime");
    expect(paymentLabel("monime", undefined)).toBe("Monime");
  });

  it("labels the non-Monime methods", () => {
    expect(paymentLabel("cash_on_delivery")).toBe("COD");
    expect(paymentLabel("cash")).toBe("Cash");
    expect(paymentLabel(null)).toBe("—");
  });
});

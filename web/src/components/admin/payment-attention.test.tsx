import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentAttention } from "@/components/admin/payment-attention";
import type { PaymentAttentionRow } from "@/lib/queries/orders";

/** Shaped like a real admin_payment_attention row: a Monime payment that landed
 *  after the reservation sweep had already cancelled the order. */
function row(over: Partial<PaymentAttentionRow> = {}): PaymentAttentionRow {
  return {
    refund_id: "r-1",
    order_id: "0a1b2c3d-4e5f-6789-abcd-ef0123456789",
    order_number: "BS-2026-000042",
    order_status: "cancelled",
    intent_status: "expired",
    amount_minor: 19000,
    currency: "SLE",
    reason: "late_monime_confirmation",
    notes: "Monime confirmed this payment AFTER the payment intent was already expired.",
    requested_at: "2026-08-29T11:15:00Z",
    ...over,
  };
}

describe("PaymentAttention", () => {
  it("renders nothing when the queue is empty (no empty banner on a healthy day)", () => {
    const { container } = render(<PaymentAttention rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names the order, the amount, and links to it", () => {
    render(<PaymentAttention rows={[row()]} />);
    const link = screen.getByRole("link", { name: /BS-2026-000042/ });
    expect(link).toHaveAttribute("href", "/orders/0a1b2c3d-4e5f-6789-abcd-ef0123456789");
    expect(screen.getByText(/1,?90\.00|190/)).toBeInTheDocument();
  });

  it("says money moved with no fulfilled order — the thing staff must act on", () => {
    const { container } = render(<PaymentAttention rows={[row()]} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/needs attention/i);
    expect(text).toMatch(/money moved/i);
  });

  it("surfaces both the order and payment status so staff can triage", () => {
    const { container } = render(<PaymentAttention rows={[row()]} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/cancelled/i);
    expect(text).toMatch(/expired/i);
  });

  it("pluralises the count correctly", () => {
    const one = render(<PaymentAttention rows={[row()]} />);
    expect(one.container.textContent).toMatch(/1 payment needs attention/i);
    one.unmount();

    const many = render(
      <PaymentAttention rows={[row(), row({ refund_id: "r-2", order_number: "BS-2026-000044" })]} />,
    );
    expect(many.container.textContent).toMatch(/2 payments need attention/i);
  });

  it("still renders when the order number is missing, falling back to the id", () => {
    render(<PaymentAttention rows={[row({ order_number: null })]} />);
    expect(screen.getByRole("link", { name: /0a1b2c3d/ })).toBeInTheDocument();
  });

  it("does not leak internal jargon into staff-facing copy", () => {
    const { container } = render(<PaymentAttention rows={[row({ notes: null })]} />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/payment_intent|late_on_dead_intent|webhook|rpc/i);
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentMixChart } from "@/components/admin/payment-mix-chart";

describe("PaymentMixChart", () => {
  it("renders without crashing given real data", () => {
    render(<PaymentMixChart codMinor={4000} prepaidMinor={6000} />);
    expect(screen.getByRole("img", { name: "Payment mix, cash on delivery versus prepaid" })).toBeInTheDocument();
  });

  it("renders without crashing given all-zero data", () => {
    render(<PaymentMixChart codMinor={0} prepaidMinor={0} />);
    expect(screen.getByRole("img", { name: "Payment mix, cash on delivery versus prepaid" })).toBeInTheDocument();
  });

  it("uses no hardcoded hex colors", () => {
    const { container } = render(<PaymentMixChart codMinor={4000} prepaidMinor={6000} />);
    const html = container.innerHTML.replace(/\sclass="[^"]*"/g, "");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});

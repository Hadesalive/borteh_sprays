import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentMixChart } from "@/components/admin/payment-mix-chart";

describe("PaymentMixChart", () => {
  it("renders without crashing given real data", () => {
    render(<PaymentMixChart appMinor={4000} tillMinor={6000} />);
    expect(screen.getByRole("img", { name: "Revenue by channel, app orders versus till sales" })).toBeInTheDocument();
  });

  it("renders without crashing given all-zero data", () => {
    render(<PaymentMixChart appMinor={0} tillMinor={0} />);
    expect(screen.getByRole("img", { name: "Revenue by channel, app orders versus till sales" })).toBeInTheDocument();
  });

  it("uses no hardcoded hex colors", () => {
    const { container } = render(<PaymentMixChart appMinor={4000} tillMinor={6000} />);
    const html = container.innerHTML.replace(/\sclass="[^"]*"/g, "");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});

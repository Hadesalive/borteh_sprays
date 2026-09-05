import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderFunnelChart } from "@/components/admin/order-funnel-chart";

const STAGES = [
  { stage: "Placed", count: 10 },
  { stage: "Confirmed", count: 8 },
  { stage: "Delivered", count: 6 },
];

const ZERO_STAGES = [
  { stage: "Placed", count: 0 },
  { stage: "Confirmed", count: 0 },
  { stage: "Delivered", count: 0 },
];

describe("OrderFunnelChart", () => {
  it("renders without crashing given real data", () => {
    render(<OrderFunnelChart stages={STAGES} />);
    expect(screen.getByRole("img", { name: "Order funnel, last 7 days" })).toBeInTheDocument();
  });

  it("renders without crashing given all-zero data", () => {
    render(<OrderFunnelChart stages={ZERO_STAGES} />);
    expect(screen.getByRole("img", { name: "Order funnel, last 7 days" })).toBeInTheDocument();
  });

  it("uses no hardcoded hex colors", () => {
    const { container } = render(<OrderFunnelChart stages={STAGES} />);
    const html = container.innerHTML.replace(/\sclass="[^"]*"/g, "");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});

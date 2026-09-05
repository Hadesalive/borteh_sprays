import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BestSellersChart } from "@/components/admin/best-sellers-chart";

const ITEMS = [
  { name: "Khamrah", minor: 50000 },
  { name: "Asad", minor: 30000 },
];

const ZERO_ITEMS = [
  { name: "Khamrah", minor: 0 },
  { name: "Asad", minor: 0 },
];

describe("BestSellersChart", () => {
  it("renders without crashing given real data", () => {
    render(<BestSellersChart items={ITEMS} />);
    expect(screen.getByRole("img", { name: "Best sellers by revenue" })).toBeInTheDocument();
  });

  it("renders without crashing given all-zero data", () => {
    render(<BestSellersChart items={ZERO_ITEMS} />);
    expect(screen.getByRole("img", { name: "Best sellers by revenue" })).toBeInTheDocument();
  });

  it("uses no hardcoded hex colors", () => {
    const { container } = render(<BestSellersChart items={ITEMS} />);
    const html = container.innerHTML.replace(/\sclass="[^"]*"/g, "");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});

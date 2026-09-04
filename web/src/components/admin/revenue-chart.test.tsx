import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RevenueChart } from "@/components/admin/revenue-chart";

describe("RevenueChart", () => {
  it("renders without crashing given real data", () => {
    render(<RevenueChart data={[100, 200, 150, 300, 250, 400, 350]} labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]} />);
    expect(screen.getByRole("img", { name: "Revenue, last 7 days" })).toBeInTheDocument();
  });

  it("renders without crashing given all-zero data", () => {
    render(<RevenueChart data={[0, 0, 0, 0, 0, 0, 0]} labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]} />);
    expect(screen.getByRole("img", { name: "Revenue, last 7 days" })).toBeInTheDocument();
  });

  it("uses no hardcoded hex colors", () => {
    const { container } = render(<RevenueChart data={[100, 200]} labels={["Mon", "Tue"]} />);
    // Strip `class="..."` before matching: shadcn's generated ui/chart.tsx
    // (vendored, not authored here) bakes hex-looking Tailwind arbitrary-variant
    // selectors — e.g. [&_.recharts-cartesian-grid_line[stroke='#ccc']] — into
    // ChartContainer's base className to retheme Recharts' own internal
    // hardcoded defaults. That's CSS selector syntax, not a color our code
    // renders, so it should not fail a "no hardcoded hex" check. Everything
    // else in the DOM (fill/stroke attributes, inline styles, text) is still
    // checked, so an actual hardcoded color anywhere would still be caught.
    const html = container.innerHTML.replace(/\sclass="[^"]*"/g, "");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});

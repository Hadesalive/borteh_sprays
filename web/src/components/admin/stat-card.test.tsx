import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "@/components/admin/stat-card";

describe("StatCard", () => {
  it("renders the label and value", () => {
    render(<StatCard label="Taken today" value="Le 1,240" />);
    expect(screen.getByText("Taken today")).toBeInTheDocument();
    expect(screen.getByText("Le 1,240")).toBeInTheDocument();
  });

  it("renders a positive delta with an up caret and success tone", () => {
    render(<StatCard label="Taken today" value="Le 1,240" delta={{ ratio: 0.12, caption: "vs last 7 days" }} />);
    const delta = screen.getByText(/12(\.0)?%/);
    expect(delta.textContent).toMatch(/▲/);
    expect(delta).toHaveClass("text-success");
    expect(screen.getByText("vs last 7 days")).toBeInTheDocument();
  });

  it("renders a negative delta with a down caret and destructive tone", () => {
    render(<StatCard label="Taken today" value="Le 1,240" delta={{ ratio: -0.08, caption: "vs last 7 days" }} />);
    const delta = screen.getByText(/8(\.0)?%/);
    expect(delta.textContent).toMatch(/▼/);
    expect(delta).toHaveClass("text-destructive");
  });

  it("renders a muted placeholder (not a colored arrow) for a flat/zero delta", () => {
    render(<StatCard label="Taken today" value="Le 1,240" delta={{ ratio: 0, caption: "vs last 7 days" }} />);
    const placeholder = screen.getByText("—");
    expect(placeholder).toHaveClass("text-muted-foreground");
    expect(placeholder).not.toHaveClass("text-success");
    expect(placeholder).not.toHaveClass("text-destructive");
    expect(screen.queryByText(/▲|▼/)).not.toBeInTheDocument();
    expect(screen.getByText("vs last 7 days")).toBeInTheDocument();
  });

  it("wraps in a link when href is given", () => {
    render(<StatCard label="Taken today" value="Le 1,240" href="/analytics" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/analytics");
  });

  it("is not a link when href is omitted", () => {
    render(<StatCard label="Taken today" value="Le 1,240" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "@/components/admin/page-header";

describe("PageHeader", () => {
  it("renders the title in the display (serif) font", () => {
    render(<PageHeader title="Orders" />);
    const heading = screen.getByRole("heading", { level: 1, name: "Orders" });
    expect(heading).toHaveClass("font-display");
  });

  it("renders an optional description", () => {
    render(<PageHeader title="Orders" description="Every order, newest first." />);
    expect(screen.getByText("Every order, newest first.")).toBeInTheDocument();
  });

  it("omits the description paragraph when none is given", () => {
    render(<PageHeader title="Orders" />);
    expect(screen.queryByText(/./, { selector: "p" })).not.toBeInTheDocument();
  });

  it("renders children as trailing actions", () => {
    render(<PageHeader title="Orders"><button>Export</button></PageHeader>);
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/admin/empty-state";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="No combos yet." />);
    expect(screen.getByText("No combos yet.")).toBeInTheDocument();
  });

  it("renders an optional description", () => {
    render(<EmptyState title="No combos yet." description="Pair two fragrances to create your first." />);
    expect(screen.getByText("Pair two fragrances to create your first.")).toBeInTheDocument();
  });

  it("renders an optional action", () => {
    render(<EmptyState title="No combos yet." action={<button>New combo</button>} />);
    expect(screen.getByRole("button", { name: "New combo" })).toBeInTheDocument();
  });

  it("omits the action slot when none is given", () => {
    render(<EmptyState title="No combos yet." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

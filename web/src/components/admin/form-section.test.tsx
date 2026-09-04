import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormSection } from "@/components/admin/form-section";

describe("FormSection", () => {
  it("renders a heading and its fields", () => {
    render(
      <FormSection title="Pricing & stock">
        <label htmlFor="price">Price</label>
      </FormSection>,
    );
    expect(screen.getByRole("heading", { name: "Pricing & stock" })).toBeInTheDocument();
    expect(screen.getByText("Price")).toBeInTheDocument();
  });

  it("renders an optional description under the heading", () => {
    render(
      <FormSection title="Pricing & stock" description="What it costs and how many are in stock.">
        <div />
      </FormSection>,
    );
    expect(screen.getByText("What it costs and how many are in stock.")).toBeInTheDocument();
  });
});

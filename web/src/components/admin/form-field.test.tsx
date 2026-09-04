import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormField } from "@/components/admin/form-field";

describe("FormField", () => {
  it("renders a visible label associated with the field via htmlFor", () => {
    render(
      <FormField label="Price" htmlFor="price">
        <input id="price" />
      </FormField>,
    );
    const input = screen.getByLabelText("Price");
    expect(input).toBeInTheDocument();
  });

  it("marks optional fields, not required ones", () => {
    render(
      <FormField label="Notes" htmlFor="notes" optional>
        <input id="notes" />
      </FormField>,
    );
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("does not show 'Optional' when the field is required", () => {
    render(
      <FormField label="Price" htmlFor="price">
        <input id="price" />
      </FormField>,
    );
    expect(screen.queryByText("Optional")).not.toBeInTheDocument();
  });

  it("renders helper text when given and no error", () => {
    render(
      <FormField label="Price" htmlFor="price" helper="In Leones, no decimals.">
        <input id="price" />
      </FormField>,
    );
    expect(screen.getByText("In Leones, no decimals.")).toBeInTheDocument();
  });

  it("renders an inline error instead of helper text, associated via aria-describedby", () => {
    render(
      <FormField label="Price" htmlFor="price" helper="In Leones, no decimals." error="Price must be greater than 0.">
        <input id="price" />
      </FormField>,
    );
    expect(screen.getByText("Price must be greater than 0.")).toBeInTheDocument();
    expect(screen.queryByText("In Leones, no decimals.")).not.toBeInTheDocument();
    const input = screen.getByLabelText("Price");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("Price must be greater than 0.");
  });
});

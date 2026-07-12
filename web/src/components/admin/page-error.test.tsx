import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageError } from "@/components/admin/page-error";

describe("PageError", () => {
  it("speaks plain English to a shop owner", () => {
    render(<PageError reset={() => {}} />);
    expect(screen.getByRole("heading")).toHaveTextContent(/couldn't load/i);
  });

  it("never leaks developer detail to the owner", () => {
    const { container } = render(<PageError reset={() => {}} />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/supabase/i);
    expect(text).not.toMatch(/env|\.local/i);
    expect(text).not.toMatch(/error:|stack|undefined/i);
  });

  it("offers a retry that calls reset", async () => {
    const reset = vi.fn();
    render(<PageError reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});

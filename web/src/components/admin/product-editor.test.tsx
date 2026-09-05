import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductEditor, type EditorInitial } from "@/components/admin/product-editor";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/app/(dashboard)/products/actions", () => ({
  saveProduct: vi.fn(async () => ({ ok: true, id: "p1" })),
}));

const BLANK: EditorInitial = {
  id: "p1",
  name: "Midnight Oud",
  brand_id: "b1",
  category_id: null,
  gender: "unisex",
  description: "",
  scent_family: "Woody",
  main_accords: [],
  release_year: null,
  is_active: true,
  is_featured: false,
  notes: [],
  variants: [],
};

const brands = [{ id: "b1", name: "Acme" }];
const categories: { id: string; name: string }[] = [];

describe("ProductEditor", () => {
  it("renders without any hardcoded hex colors", () => {
    const { container } = render(<ProductEditor initial={BLANK} brands={brands} categories={categories} />);
    expect(container.innerHTML).not.toMatch(/\[#[0-9a-fA-F]{3,8}\]/);
  });

  it("disables Save until the form is actually edited", async () => {
    render(<ProductEditor initial={BLANK} brands={brands} categories={categories} />);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Name"), "!");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("shows an inline error under Scent family when it's cleared, without a global banner", async () => {
    render(<ProductEditor initial={BLANK} brands={brands} categories={categories} />);
    const scentField = screen.getByLabelText("Scent family");
    await userEvent.clear(scentField);
    expect(screen.getByText(/required for this product to be recommended/i)).toBeInTheDocument();
  });

  it("shows a visible label for every field, not placeholder-only", () => {
    render(<ProductEditor initial={BLANK} brands={brands} categories={categories} />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Brand")).toBeInTheDocument();
    expect(screen.getByLabelText("Scent family")).toBeInTheDocument();
  });
});

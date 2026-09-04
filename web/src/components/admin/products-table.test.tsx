import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductsTable, type ProductRow } from "@/components/admin/products-table";

const rows: ProductRow[] = [
  {
    id: "1",
    name: "Midnight Oud",
    brand: "Acme",
    family: "Woody",
    fromPriceMinor: 74000,
    band: "in_stock",
    active: true,
    featured: false,
    variantCount: 2,
  },
];

describe("ProductsTable", () => {
  it("renders product rows without any hardcoded hex colors", () => {
    const { container } = render(<ProductsTable rows={rows} summary={[]} empty="No products." />);
    expect(screen.getByText("Midnight Oud")).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/\[#[0-9a-fA-F]{3,8}\]/);
  });

  it("shows the empty state copy when there are no products", () => {
    render(<ProductsTable rows={[]} summary={[]} empty="No products yet." />);
    expect(screen.getByText("No products yet.")).toBeInTheDocument();
  });

  it("shows a warning chip instead of the scent family when one is missing", () => {
    const missingFamily: ProductRow[] = [{ ...rows[0], family: null }];
    render(<ProductsTable rows={missingFamily} summary={[]} empty="No products." />);
    expect(screen.getByText("Needs family")).toBeInTheDocument();
  });

  it("filters rows by the search box", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const two: ProductRow[] = [rows[0], { ...rows[0], id: "2", name: "Rose Garden" }];
    render(<ProductsTable rows={two} summary={[]} empty="No products." />);
    await userEvent.type(screen.getByPlaceholderText("Search name, brand, family…"), "Rose");
    expect(screen.queryByText("Midnight Oud")).not.toBeInTheDocument();
    expect(screen.getByText("Rose Garden")).toBeInTheDocument();
  });
});

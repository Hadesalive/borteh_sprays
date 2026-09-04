import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryTable, type InvRow } from "@/components/admin/inventory-table";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const rows: InvRow[] = [
  {
    id: "1",
    variantId: "v1",
    name: "Midnight Oud",
    meta: "Acme · 50 ml",
    sku: "MO-050",
    onHand: 12,
    available: 10,
    reorderPoint: 5,
    priceMinor: 74000,
    statusLabel: "In stock",
    statusTone: "success",
  },
];

describe("InventoryTable", () => {
  it("renders rows without any hardcoded hex colors", () => {
    const { container } = render(<InventoryTable rows={rows} summary={[]} empty="No inventory." />);
    expect(screen.getByText("Midnight Oud")).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/\[#[0-9a-fA-F]{3,8}\]/);
  });

  it("shows the empty state copy when there are no rows", () => {
    render(<InventoryTable rows={[]} summary={[]} empty="No inventory items yet." />);
    expect(screen.getByText("No inventory items yet.")).toBeInTheDocument();
  });

  it("has no Receive column until 'Receive stock' is toggled on", () => {
    render(<InventoryTable rows={rows} summary={[]} empty="No inventory." />);
    expect(screen.queryByPlaceholderText("Qty")).not.toBeInTheDocument();
  });

  it("shows a Qty input per row after toggling 'Receive stock' on", async () => {
    render(<InventoryTable rows={rows} summary={[]} empty="No inventory." />);
    await userEvent.click(screen.getByRole("button", { name: "Receive stock" }));
    expect(screen.getByPlaceholderText("Qty")).toBeInTheDocument();
  });
});

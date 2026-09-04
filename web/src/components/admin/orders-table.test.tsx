import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrdersTable, type OrderRow } from "@/components/admin/orders-table";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const orders: OrderRow[] = [
  {
    id: "1",
    number: "1001",
    placed: "Sep 1, 2:30 PM",
    customer: "Aminata",
    phone: "+232 76 000000",
    channel: "Delivery",
    payment: "Cash on delivery",
    status: "pending",
    statusLabel: "Pending",
    statusTone: "warning",
    minor: 74000,
  },
];

describe("OrdersTable", () => {
  it("renders order rows without any hardcoded hex colors", () => {
    const { container } = render(<OrdersTable orders={orders} summary={[]} page={0} total={1} />);
    expect(screen.getByText("#1001")).toBeInTheDocument();
    // Match Tailwind's arbitrary-value hex bracket syntax (e.g. `text-[#B5B2AC]`)
    // rather than any hex-looking substring — "#1001" (the order number) is
    // itself valid hex digits and would false-positive on a bare hex regex.
    expect(container.innerHTML).not.toMatch(/\[#[0-9a-fA-F]{3,8}\]/);
  });

  it("shows the empty state copy when there are no orders", () => {
    render(<OrdersTable orders={[]} summary={[]} page={0} total={0} />);
    expect(screen.getByText("No orders yet.")).toBeInTheDocument();
  });
});

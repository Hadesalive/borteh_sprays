import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable } from "@/components/admin/data-table";

type Row = { id: string; name: string; total: number };

const rows: Row[] = [
  { id: "1", name: "Alpha", total: 100 },
  { id: "2", name: "Beta", total: 200 },
];

const columns = [
  { header: "Name", render: (r: Row) => r.name },
  { header: "Total", align: "right" as const, render: (r: Row) => String(r.total) },
];

describe("DataTable", () => {
  it("renders one row per item with the given columns", () => {
    render(<DataTable rows={rows} rowKey={(r) => r.id} columns={columns} empty="No rows." />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("shows the EmptyState when there are no rows", () => {
    render(<DataTable rows={[]} rowKey={(r: Row) => r.id} columns={columns} empty="No rows." />);
    expect(screen.getByText("No rows.")).toBeInTheDocument();
  });

  it("calls onRowClick with the row when a row is clicked", async () => {
    const onRowClick = vi.fn();
    render(<DataTable rows={rows} rowKey={(r) => r.id} columns={columns} empty="No rows." onRowClick={onRowClick} />);
    await userEvent.click(screen.getByText("Alpha"));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("renders the summary strip when given", () => {
    render(
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        columns={columns}
        empty="No rows."
        summary={[{ n: "2", label: "total", tone: "text-foreground" }]}
      />,
    );
    expect(screen.getByText("total")).toBeInTheDocument();
  });

  it("renders pagination when given and disables Previous on the first page", () => {
    render(
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        columns={columns}
        empty="No rows."
        pagination={{ page: 0, pageSize: 2, total: 4, hrefFor: (p) => `/x?page=${p}` }}
      />,
    );
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/x?page=1");
  });
});

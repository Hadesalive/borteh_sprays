"use client";

import { useRouter } from "next/navigation";

import { formatInt, formatLe } from "@/lib/format";
import { Chip, type Tone } from "@/components/admin/chip";
import { DataTable, type DataTableColumn, type DataTablePagination, type DataTableSummaryStat } from "@/components/admin/data-table";

export type CustomerRow = {
  id: string;
  name: string;
  contact: string;
  tierLabel: string;
  tierTone: Tone;
  orders: number;
  spent: number;
  last: string;
};

export function CustomersTable({
  customers,
  summary,
  page,
  total,
  pageSize,
}: {
  customers: CustomerRow[];
  summary: DataTableSummaryStat[];
  page: number;
  total: number;
  pageSize: number;
}) {
  const router = useRouter();

  const columns: DataTableColumn<CustomerRow>[] = [
    {
      header: "Customer",
      render: (c) => (
        <>
          {c.name} <span className="nums font-normal text-xs text-muted-foreground">{c.contact}</span>
        </>
      ),
    },
    { header: "Tier", render: (c) => <Chip tone={c.tierTone}>{c.tierLabel}</Chip> },
    { header: "Orders", align: "right", render: (c) => <span className="nums">{formatInt(c.orders)}</span> },
    { header: "Total spent", align: "right", render: (c) => <span className="nums font-medium">{formatLe(c.spent, 2)}</span> },
    { header: "Last order", align: "right", render: (c) => <span className="text-muted-foreground">{c.last}</span> },
  ];

  const pagination: DataTablePagination | undefined =
    total > customers.length ? { page, pageSize, total, hrefFor: (p) => `/customers?page=${p}` } : undefined;

  return (
    <DataTable
      summary={summary}
      columns={columns}
      rows={customers}
      rowKey={(c) => c.id}
      onRowClick={(c) => router.push(`/customers/${c.id}`)}
      empty="No customers match this view."
      pagination={pagination}
    />
  );
}

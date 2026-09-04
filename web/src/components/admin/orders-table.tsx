"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { formatLe } from "@/lib/format";
import { Chip, type Tone } from "@/components/admin/chip";
import { PAGE_SIZE } from "@/lib/queries/orders";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";

export type OrderRow = {
  id: string;
  number: string;
  placed: string;
  customer: string;
  phone: string;
  channel: string;
  payment: string;
  status: string;
  statusLabel: string;
  statusTone: Tone;
  minor: number;
};

export type SummaryStat = { n: string; label: string; tone: string };

export function OrdersTable({
  orders,
  summary,
  page,
  total,
}: {
  orders: OrderRow[];
  summary: SummaryStat[];
  page: number;
  total: number;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const filters = useMemo(() => {
    const seen = new Map<string, string>();
    for (const o of orders) if (!seen.has(o.status)) seen.set(o.status, o.statusLabel);
    return [{ key: "all", label: "All" }, ...[...seen].map(([key, label]) => ({ key, label }))];
  }, [orders]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .filter((o) => filter === "all" || o.status === filter)
      .filter((o) => !q || o.number.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q) || o.phone.includes(q));
  }, [orders, filter, query]);

  const columns: DataTableColumn<OrderRow>[] = [
    {
      header: "Order",
      render: (o) => (
        <span className="nums font-medium">
          #{o.number} <span className="nums font-normal text-[12px] text-muted-foreground">{o.placed}</span>
        </span>
      ),
    },
    {
      header: "Customer",
      render: (o) => (
        <span>
          {o.customer} <span className="nums text-[12px] text-muted-foreground">{o.phone}</span>
        </span>
      ),
    },
    { header: "Channel", render: (o) => <span className="text-muted-foreground">{o.channel}</span> },
    { header: "Payment", render: (o) => <span className="text-muted-foreground">{o.payment}</span> },
    { header: "Status", render: (o) => <Chip tone={o.statusTone}>{o.statusLabel}</Chip> },
    {
      header: "Total",
      align: "right",
      render: (o) => <span className="nums font-medium">{formatLe(o.minor, 2)}</span>,
    },
  ];

  return (
    <DataTable
      summary={summary}
      search={
        <>
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order, name, phone"
              className="h-8 w-60 border border-border bg-card pl-8 pr-3 text-[13px] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
            />
          </div>
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-7 px-2.5 text-xs font-medium transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </>
      }
      columns={columns}
      rows={rows}
      rowKey={(o) => o.id}
      onRowClick={(o) => router.push(`/orders/${o.id}`)}
      empty={orders.length === 0 ? "No orders yet." : "No orders match this view."}
      pagination={
        total > orders.length
          ? { page, pageSize: PAGE_SIZE, total, hrefFor: (p) => `/orders?page=${p}` }
          : undefined
      }
    />
  );
}

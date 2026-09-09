"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { formatLe } from "@/lib/format";
import { Chip } from "@/components/admin/chip";
import { POS_PAGE_SIZE } from "@/lib/queries/pos-sales";
import { DataTable, type DataTableColumn, type DataTableSummaryStat } from "@/components/admin/data-table";

export type PosSaleRow = {
  id: string;
  receipt: string;
  soldAt: string;
  cashier: string;
  items: string;
  payment: string;
  reference: string | null;
  status: "completed" | "voided";
  minor: number;
};

export function PosSalesTable({
  sales,
  summary,
  page,
  total,
}: {
  sales: PosSaleRow[];
  summary: DataTableSummaryStat[];
  page: number;
  total: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter(
      (s) =>
        s.receipt.toLowerCase().includes(q) ||
        s.cashier.toLowerCase().includes(q) ||
        s.items.toLowerCase().includes(q) ||
        (s.reference ?? "").toLowerCase().includes(q),
    );
  }, [sales, query]);

  const columns: DataTableColumn<PosSaleRow>[] = [
    {
      header: "Receipt",
      render: (s) => (
        <span className={cn("nums font-medium", s.status === "voided" && "text-muted-foreground line-through")}>
          {s.receipt} <span className="nums font-normal text-[12px] text-muted-foreground no-underline">{s.soldAt}</span>
        </span>
      ),
    },
    { header: "Items", render: (s) => <span className="text-muted-foreground">{s.items}</span> },
    { header: "Cashier", render: (s) => <span className="text-muted-foreground">{s.cashier}</span> },
    {
      header: "Payment",
      render: (s) => (
        <span className="text-muted-foreground">
          {s.payment}
          {s.reference ? <span className="nums ml-1.5 text-[12px]">· {s.reference}</span> : null}
        </span>
      ),
    },
    {
      header: "Status",
      render: (s) => <Chip tone={s.status === "voided" ? "danger" : "success"}>{s.status === "voided" ? "Voided" : "Completed"}</Chip>,
    },
    {
      header: "Total",
      align: "right",
      render: (s) => (
        <span className={cn("nums font-medium", s.status === "voided" && "text-muted-foreground line-through")}>{formatLe(s.minor, 2)}</span>
      ),
    },
  ];

  return (
    <DataTable
      summary={summary}
      search={
        <label className="relative w-full max-w-xs">
          <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Receipt, cashier, product, reference…"
            className="h-8 w-full border border-border bg-background pl-8 pr-3 text-[13px] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          />
        </label>
      }
      columns={columns}
      rows={rows}
      rowKey={(s) => s.id}
      onRowClick={(s) => router.push(`/pos/sales/${s.id}`)}
      empty={query ? "No receipts match." : "No till sales yet."}
      pagination={{ page, pageSize: POS_PAGE_SIZE, total, hrefFor: (p) => `/pos/sales?page=${p}` }}
    />
  );
}

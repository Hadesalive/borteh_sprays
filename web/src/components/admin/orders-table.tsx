"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { formatLe } from "@/lib/format";
import { Chip, type Tone } from "@/components/admin/chip";
import { Button } from "@/components/ui/button";
import { PAGE_SIZE } from "@/lib/queries/orders";

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

const th = "px-3 py-1.5 text-left text-xs font-medium text-muted-foreground";

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

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_1px_0_rgba(26,26,26,0.07)]">
      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-border px-4 py-2.5">
        {summary.map((s) => (
          <span key={s.label} className="text-[13px] text-muted-foreground">
            <span className={cn("nums font-[650]", s.tone)}>{s.n}</span> {s.label}
          </span>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="relative">
          <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order, name, phone"
            className="h-8 w-60 rounded-lg border border-border bg-card pl-8 pr-3 text-[13px] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
          />
        </div>
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "h-7 rounded-lg px-2.5 text-xs font-medium transition-colors",
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th className={cn(th, "pl-4")}>Order</th>
              <th className={th}>Customer</th>
              <th className={th}>Channel</th>
              <th className={th}>Payment</th>
              <th className={th}>Status</th>
              <th className={cn(th, "pr-4 text-right")}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr
                key={o.id}
                onClick={() => router.push(`/orders/${o.id}`)}
                className="cursor-pointer border-t border-accent transition-colors hover:bg-muted"
              >
                <td className="nums py-1.5 pl-4 pr-3 font-medium">
                  #{o.number} <span className="nums font-normal text-[12px] text-[#B5B2AC]">{o.placed}</span>
                </td>
                <td className="px-3 py-1.5">
                  {o.customer} <span className="nums text-[12px] text-[#B5B2AC]">{o.phone}</span>
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">{o.channel}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{o.payment}</td>
                <td className="px-3 py-1.5"><Chip tone={o.statusTone}>{o.statusLabel}</Chip></td>
                <td className="nums py-1.5 pl-3 pr-4 text-right font-medium">{formatLe(o.minor, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 ? (
          <div className="px-4 py-16 text-center text-[13px] text-muted-foreground">
            {orders.length === 0 ? "No orders yet." : "No orders match this view."}
          </div>
        ) : null}
      </div>

      {total > orders.length && (
        <nav
          aria-label="Orders pagination"
          className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground"
        >
          <span className="nums">
            {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + orders.length} of {total}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              disabled={page === 0}
              render={<a href={`/orders?page=${page - 1}`} />}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              disabled={(page + 1) * PAGE_SIZE >= total}
              render={<a href={`/orders?page=${page + 1}`} />}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}

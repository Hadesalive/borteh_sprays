"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { formatLe } from "@/lib/format";
import { StatusPill, type PillTone } from "@/components/admin/status-pill";

export type OrderRow = {
  id: string;
  number: string;
  placed: string;
  customer: string;
  phone: string;
  channel: string;
  payment: { label: string; tone: PillTone };
  status: string;
  statusLabel: string;
  statusTone: PillTone;
  minor: number;
};

export function OrdersTable({ orders }: { orders: OrderRow[] }) {
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
      .filter(
        (o) =>
          !q ||
          o.number.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q) ||
          o.phone.includes(q)
      );
  }, [orders, filter, query]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 px-6 py-4 lg:px-10">
        <div className="relative max-w-xs">
          <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order, name, phone…"
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-7 rounded-full border px-3 text-xs font-medium transition-colors",
                filter === f.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-t border-border text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-6 py-2.5 font-medium lg:px-10">Order</th>
              <th className="px-3 py-2.5 font-medium">Customer</th>
              <th className="px-3 py-2.5 font-medium">Channel</th>
              <th className="px-3 py-2.5 font-medium">Payment</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-right font-medium">Total</th>
              <th className="px-6 py-2.5 lg:px-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border border-t border-border">
            {rows.map((o) => (
              <tr key={o.id} className="group transition-colors hover:bg-muted/40">
                <td className="px-6 py-3.5 lg:px-10">
                  <Link href={`/orders/${o.id}`} className="block">
                    <span className="nums font-medium">#{o.number}</span>
                    <span className="block text-xs text-muted-foreground">{o.placed}</span>
                  </Link>
                </td>
                <td className="px-3 py-3.5">
                  <span className="block font-medium">{o.customer}</span>
                  <span className="nums block text-xs text-muted-foreground">{o.phone}</span>
                </td>
                <td className="px-3 py-3.5 text-muted-foreground">{o.channel}</td>
                <td className="px-3 py-3.5">
                  <StatusPill tone={o.payment.tone}>{o.payment.label}</StatusPill>
                </td>
                <td className="px-3 py-3.5">
                  <StatusPill tone={o.statusTone} dot>
                    {o.statusLabel}
                  </StatusPill>
                </td>
                <td className="nums px-3 py-3.5 text-right font-semibold">{formatLe(o.minor, 2)}</td>
                <td className="px-6 py-3.5 text-right lg:px-10">
                  <Link href={`/orders/${o.id}`} aria-label={`Open order ${o.number}`}>
                    <ArrowRight className="inline-block size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground lg:px-10">
            {orders.length === 0 ? "No orders yet." : "No orders match this view."}
          </div>
        ) : null}
      </div>
    </>
  );
}

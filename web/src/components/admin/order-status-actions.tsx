"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setOrderStatus, type OrderStatus } from "@/app/(dashboard)/orders/actions";

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending_payment: "confirmed",
  confirmed: "preparing",
  preparing: "out_for_delivery",
  out_for_delivery: "delivered",
};

const TERMINAL = new Set<OrderStatus>(["delivered", "cancelled", "returned"]);

const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function OrderStatusActions({ id, status }: { id: string; status: OrderStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = NEXT[status];
  const terminal = TERMINAL.has(status);

  function go(to: OrderStatus) {
    start(async () => {
      const res = await setOrderStatus(id, to);
      if (res.ok) router.refresh();
      else alert(res.error);
    });
  }

  if (terminal && !next) {
    return <span className="text-sm text-muted-foreground">No further action</span>;
  }

  return (
    <>
      {!terminal ? (
        <button
          type="button"
          onClick={() => {
            if (confirm("Cancel this order?")) go("cancelled");
          }}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-60"
        >
          Cancel
        </button>
      ) : null}
      {next ? (
        <button
          type="button"
          onClick={() => go(next)}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : `Mark ${humanize(next)}`}
        </button>
      ) : null}
    </>
  );
}

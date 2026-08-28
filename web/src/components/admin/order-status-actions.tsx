"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { cancelPendingMonimeOrder, setOrderStatus, type OrderStatus } from "@/app/(dashboard)/orders/actions";

// pending_payment -> confirmed is deliberately NOT here: that transition
// only ever happens via the verified Monime webhook (fn_confirm_monime_payment).
// A manual "confirm" button here would let staff push an order through with
// no payment check at all — see fn_cancel_pending_monime_order's migration note.
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
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
  const awaitingPayment = status === "pending_payment";

  function go(to: OrderStatus) {
    start(async () => {
      const res = await setOrderStatus(id, to);
      if (res.ok) router.refresh();
      else alert(res.error);
    });
  }

  function cancelUnpaid() {
    if (!confirm("Cancel this order? Payment never went through — its stock hold will be released.")) return;
    start(async () => {
      const res = await cancelPendingMonimeOrder(id);
      if (res.ok) router.refresh();
      else alert(res.error);
    });
  }

  if (awaitingPayment) {
    return (
      <>
        <span className="text-sm text-muted-foreground">Waiting for Monime payment — confirms automatically</span>
        <button
          type="button"
          onClick={cancelUnpaid}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-60"
        >
          Cancel
        </button>
      </>
    );
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

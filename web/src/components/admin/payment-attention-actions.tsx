"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { resolvePaymentAttention } from "@/app/(dashboard)/orders/actions";

/** Clears a flagged payment off the Orders banner.
 *
 *  Monime has no refund API — the money moves by hand in their dashboard — so
 *  this records that it was handled rather than doing it. That distinction is
 *  why the button says "Mark refunded" and not "Refund".
 *
 *  "Working on it" exists so two people don't both refund the same payment: it
 *  keeps the row visible but shows someone has picked it up. */
export function PaymentAttentionActions({ refundId }: { refundId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showRef, setShowRef] = useState(false);
  const [ref, setRef] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(outcome: "completed" | "manual_processing", monimeRef?: string) {
    setError(null);
    start(async () => {
      const res = await resolvePaymentAttention(refundId, outcome, monimeRef);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  if (showRef) {
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run("completed", ref);
        }}
      >
        <input
          autoFocus
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="Monime reference (optional)"
          aria-label="Monime refund reference"
          className="h-7 w-52 rounded border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-7 rounded bg-foreground px-2.5 text-xs font-medium text-background disabled:opacity-50"
        >
          {pending ? "Saving…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setShowRef(false)}
          className="h-7 rounded px-2 text-xs text-muted-foreground underline underline-offset-2"
        >
          Cancel
        </button>
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setShowRef(true)}
        disabled={pending}
        className="h-7 rounded border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        Mark refunded
      </button>
      <button
        type="button"
        onClick={() => run("manual_processing")}
        disabled={pending}
        className="h-7 rounded px-2 text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        Working on it
      </button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

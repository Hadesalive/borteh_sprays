"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Package, X } from "@phosphor-icons/react";

import { receiveStock } from "@/app/(dashboard)/inventory/actions";

export function InventoryReceive({ variantId }: { variantId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const n = parseInt(qty, 10);
    start(async () => {
      const res = await receiveStock(variantId, n);
      if (res.ok) {
        setOpen(false);
        setQty("");
        router.refresh();
      } else {
        alert(res.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Package className="size-3.5" />
        Receive
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={1}
        autoFocus
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") { setOpen(false); setQty(""); }
        }}
        placeholder="Qty"
        className="nums h-8 w-16 rounded-md border border-border bg-background px-2 text-right text-xs focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
      />
      <button type="button" onClick={submit} disabled={pending} aria-label="Confirm" className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60">
        <Check className="size-4" />
      </button>
      <button type="button" onClick={() => { setOpen(false); setQty(""); }} aria-label="Cancel" className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted">
        <X className="size-4" />
      </button>
    </span>
  );
}

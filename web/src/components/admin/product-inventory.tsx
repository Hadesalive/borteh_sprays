"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import { formatInt } from "@/lib/format";
import { Chip, type Tone } from "@/components/admin/chip";
import { receiveStock, adjustStock, stocktake } from "@/app/(dashboard)/products/actions";

export type InventoryVariant = {
  variantId: string;
  sku: string;
  label: string;
  band: "in_stock" | "low" | "out" | null;
  onHand: number;
  reserved: number;
  available: number;
  reorderPoint: number;
};

const BAND: Record<string, { label: string; tone: Tone }> = {
  in_stock: { label: "In stock", tone: "success" },
  low: { label: "Low", tone: "warning" },
  out: { label: "Out", tone: "danger" },
  none: { label: "No stock", tone: "neutral" },
};

type Mode = "receive" | "adjust" | "count";
const MODES: { key: Mode; label: string; hint: string; placeholder: string }[] = [
  { key: "receive", label: "Receive", hint: "Add units from a delivery.", placeholder: "Qty in" },
  { key: "adjust", label: "Adjust", hint: "Correct a discrepancy (±, e.g. -2).", placeholder: "± delta" },
  { key: "count", label: "Count", hint: "Set on-hand to a physical count.", placeholder: "Counted total" },
];

const smallInput =
  "nums h-8 w-full rounded-md border border-border bg-background px-2.5 text-[13px] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className={cn("nums text-base font-[650]", tone)}>{formatInt(value)}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function VariantRow({ v, productId }: { v: InventoryVariant; productId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("receive");
  const [val, setVal] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const b = BAND[v.band ?? "none"];
  const activeMode = MODES.find((m) => m.key === mode)!;

  function apply() {
    setErr(null);
    const n = parseInt(val, 10);
    if (!Number.isFinite(n)) { setErr("Enter a number."); return; }
    start(async () => {
      const res =
        mode === "receive" ? await receiveStock({ variantId: v.variantId, qty: n, productId, reason })
        : mode === "adjust" ? await adjustStock({ variantId: v.variantId, delta: n, productId, reason })
        : await stocktake({ variantId: v.variantId, count: n, productId, reason });
      if (res.ok) { setVal(""); setReason(""); router.refresh(); }
      else setErr(res.error);
    });
  }

  return (
    <div className="border-t border-border px-5 py-4 first:border-t-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{v.label}</div>
          <div className="nums truncate text-[12px] text-[#B5B2AC]">{v.sku}</div>
        </div>
        <Chip tone={b.tone}>{b.label}</Chip>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="On hand" value={v.onHand} />
        <Stat label="Reserved" value={v.reserved} />
        <Stat label="Available" value={v.available} tone={v.available <= 0 ? "text-destructive" : v.available <= v.reorderPoint ? "text-warning" : undefined} />
      </div>

      <div className="mt-3">
        <div className="inline-flex rounded-md border border-border p-0.5">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => { setMode(m.key); setErr(null); }}
              className={cn(
                "h-6 rounded px-2 text-[12px] font-medium transition-colors",
                mode === m.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">{activeMode.hint}</p>

        <div className="mt-2 flex items-center gap-2">
          <input
            className={cn(smallInput, "w-28 text-right")}
            inputMode="numeric"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            placeholder={activeMode.placeholder}
          />
          <input
            className={cn(smallInput, "flex-1")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            placeholder="Reason (optional)"
          />
          <button
            type="button"
            onClick={apply}
            disabled={pending || !val.trim()}
            className="h-8 shrink-0 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-[#1a1917] disabled:opacity-40"
          >
            {pending ? "…" : "Apply"}
          </button>
        </div>
        {err ? <p className="mt-1.5 text-[12px] text-destructive-soft-foreground">{err}</p> : null}
      </div>
    </div>
  );
}

export function ProductInventory({ productId, variants }: { productId: string; variants: InventoryVariant[] }) {
  return (
    <div className="h-fit overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_1px_0_rgba(26,26,26,0.07)]">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-[13px] font-[650] tracking-[-0.1px]">Inventory</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Every stock move is logged and attributed. Receiving into an out-of-stock variant notifies waitlisters.</p>
      </div>
      {variants.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">No variants to stock yet.</p>
      ) : (
        variants.map((v) => <VariantRow key={v.variantId} v={v} productId={productId} />)
      )}
    </div>
  );
}

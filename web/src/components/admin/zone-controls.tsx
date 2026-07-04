"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, PencilSimple, X } from "@phosphor-icons/react";

import { setZoneActive, setZoneFee } from "@/app/(dashboard)/settings/zones/actions";
import { formatLe } from "@/lib/format";
import { Toggle } from "@/components/admin/toggle";

export function ZoneControls({ id, feeMinor, active }: { id: string; feeMinor: number; active: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(Math.round(feeMinor / 100)));
  const [pending, start] = useTransition();

  function saveFee() {
    const le = parseInt(val, 10);
    if (!Number.isFinite(le) || le < 0) return;
    start(async () => {
      const res = await setZoneFee(id, le * 100);
      if (res.ok) { setEditing(false); router.refresh(); }
      else alert(res.error);
    });
  }

  return (
    <div className="flex items-center gap-5">
      {editing ? (
        <span className="inline-flex items-center gap-1">
          <span className="text-sm text-muted-foreground">Le</span>
          <input
            type="number"
            min={0}
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveFee(); if (e.key === "Escape") setEditing(false); }}
            className="nums h-8 w-24 rounded-md border border-border bg-background px-2 text-right text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          />
          <button type="button" onClick={saveFee} disabled={pending} aria-label="Save" className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            <Check className="size-4" />
          </button>
          <button type="button" onClick={() => setEditing(false)} aria-label="Cancel" className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="nums inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-primary">
          {formatLe(feeMinor)}
          <PencilSimple className="size-3.5 text-muted-foreground" />
        </button>
      )}
      <Toggle defaultOn={active} label="Zone active" onChange={(on) => start(async () => { await setZoneActive(id, on); router.refresh(); })} />
    </div>
  );
}

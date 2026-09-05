"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sparkle } from "@phosphor-icons/react";

import { grantPoints, setTier } from "@/app/(dashboard)/customers/actions";
import { formatInt } from "@/lib/format";
import { FormField } from "@/components/admin/form-field";

type Tier = { id: string; name: string; discount: number };

export function CustomerLoyalty({
  userId,
  points,
  currentTierId,
  tiers,
}: {
  userId: string;
  points: number;
  currentTierId: string | null;
  tiers: Tier[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [grantErr, setGrantErr] = useState<string | null>(null);
  const [tierErr, setTierErr] = useState<string | null>(null);

  function grant() {
    const n = parseInt(amount, 10);
    setGrantErr(null);
    start(async () => {
      const res = await grantPoints(userId, n, reason);
      if (res.ok) { setAmount(""); setReason(""); router.refresh(); }
      else setGrantErr(res.error);
    });
  }

  function changeTier(tierId: string) {
    setTierErr(null);
    start(async () => {
      const res = await setTier(userId, tierId || null);
      if (res.ok) router.refresh();
      else setTierErr(res.error);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Loyalty</h2>

      <div className="mt-3 flex items-baseline gap-2">
        <Sparkle weight="duotone" className="size-5 text-primary" />
        <span className="nums text-2xl font-semibold tracking-tight">{formatInt(points)}</span>
        <span className="text-sm text-muted-foreground">points</span>
      </div>

      <div className="mt-4">
        <FormField label="Loyalty card" htmlFor="loyalty-tier" error={tierErr ?? undefined}>
          <select
            id="loyalty-tier"
            value={currentTierId ?? ""}
            onChange={(e) => changeTier(e.target.value)}
            disabled={pending}
            className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <option value="">No card</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>{t.name} · {t.discount}% off</option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-sm font-medium">Grant points</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <FormField label="Points" htmlFor="grant-amount" error={grantErr ?? undefined}>
            <input
              id="grant-amount"
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setGrantErr(null); }}
              className="nums h-9 w-24 rounded-md border border-border bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            />
          </FormField>
          <FormField label="Reason" htmlFor="grant-reason" optional>
            <input
              id="grant-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            />
          </FormField>
          <button
            type="button"
            onClick={grant}
            disabled={pending || !amount}
            className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            Apply
          </button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">Use a negative number to deduct.</p>
      </div>
    </div>
  );
}

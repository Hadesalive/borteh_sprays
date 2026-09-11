"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash } from "@phosphor-icons/react";

import { formatLe } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/admin/chip";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/admin/empty-state";
import { createTier, deleteTier, updateTier } from "@/app/(dashboard)/settings/loyalty/actions";

export type TierRow = {
  id: string;
  name: string;
  thresholdMinor: number;
  discountPercent: number;
  isActive: boolean;
};

type Draft = { name: string; thresholdLe: string; discountPercent: string; isActive: boolean };

const input =
  "h-9 w-full border border-border bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";

const toDraft = (t: TierRow): Draft => ({
  name: t.name,
  thresholdLe: (t.thresholdMinor / 100).toString(),
  discountPercent: t.discountPercent.toString(),
  isActive: t.isActive,
});

const EMPTY: Draft = { name: "", thresholdLe: "", discountPercent: "", isActive: true };

export function LoyaltyTiers({ tiers, tiersEnabled }: { tiers: TierRow[]; tiersEnabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function beginEdit(t: TierRow) {
    setError(null);
    setAdding(false);
    setEditingId(t.id);
    setDraft(toDraft(t));
  }

  function beginAdd() {
    setError(null);
    setEditingId(null);
    setDraft(EMPTY);
    setAdding(true);
  }

  function cancel() {
    setEditingId(null);
    setAdding(false);
    setError(null);
  }

  function submit() {
    setError(null);
    const payload = {
      name: draft.name,
      thresholdLe: Number.parseFloat(draft.thresholdLe),
      discountPercent: Number.parseFloat(draft.discountPercent),
      isActive: draft.isActive,
    };
    start(async () => {
      const res = editingId ? await updateTier(editingId, payload) : await createTier(payload);
      if (res.ok) {
        cancel();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function remove(t: TierRow) {
    if (!confirm(`Delete the ${t.name} tier? Members on it fall back to whichever tier their spend still clears.`)) return;
    setError(null);
    start(async () => {
      const res = await deleteTier(t.id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  const form = (
    <div className="space-y-3 border-t border-accent bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Name</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Gold"
            className={cn(input, "mt-1")}
            autoFocus
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Spend to reach</span>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-[13px] text-muted-foreground">Le</span>
            <input
              type="number"
              min={0}
              step="1"
              value={draft.thresholdLe}
              onChange={(e) => setDraft({ ...draft, thresholdLe: e.target.value })}
              placeholder="5000"
              className={cn(input, "nums w-32 text-right")}
            />
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Discount</span>
          <div className="mt-1 flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={draft.discountPercent}
              onChange={(e) => setDraft({ ...draft, discountPercent: e.target.value })}
              placeholder="5"
              className={cn(input, "nums w-24 text-right")}
            />
            <span className="text-[13px] text-muted-foreground">%</span>
          </div>
        </label>
      </div>

      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={draft.isActive}
          onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
          className="size-4 accent-primary"
        />
        Active — customers can reach this tier
      </label>

      {error ? (
        <p role="alert" className="bg-destructive-soft px-3 py-2 text-[13px] text-destructive-soft-foreground">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex h-8 items-center bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-bevel transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : editingId ? "Save tier" : "Add tier"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="inline-flex h-8 items-center border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-muted disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="border-b pt-4">
        <CardTitle role="heading" aria-level={2}>Tiers</CardTitle>
        <CardDescription>
          A customer automatically gets the biggest discount their lifetime spend qualifies for. Thresholds are checked at
          checkout, so lowering one gives that discount to everyone already above it straight away.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        {!tiersEnabled && tiers.length > 0 ? (
          <p className="border-b border-accent px-4 py-2.5 text-[13px] text-warning">
            Tiers are switched off in Programme, so none of these discounts apply yet.
          </p>
        ) : null}

        {tiers.length === 0 && !adding ? (
          <EmptyState title="No tiers yet." description="Add one to reward customers who keep coming back." />
        ) : (
          <ul className="divide-y divide-accent">
            {tiers.map((t) => (
              <li key={t.id}>
                {editingId === t.id ? (
                  form
                ) : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium">{t.name}</p>
                      <p className="nums mt-0.5 text-xs text-muted-foreground">
                        From {formatLe(t.thresholdMinor)} lifetime spend
                      </p>
                    </div>
                    <span className="nums text-[13px] font-medium">{t.discountPercent}% off</span>
                    <Chip tone={t.isActive ? "success" : "neutral"}>{t.isActive ? "Active" : "Inactive"}</Chip>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => beginEdit(t)}
                        disabled={pending}
                        className="inline-flex h-8 items-center border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-muted disabled:opacity-60"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(t)}
                        disabled={pending}
                        aria-label={`Delete the ${t.name} tier`}
                        className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-destructive disabled:opacity-60"
                      >
                        <Trash className="size-4" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {adding ? form : null}

        {!adding && editingId === null ? (
          <div className="border-t border-accent p-4">
            <button
              type="button"
              onClick={beginAdd}
              className="inline-flex h-8 items-center gap-1.5 border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-muted"
            >
              <Plus weight="duotone" className="size-4" />
              Add tier
            </button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateLoyaltyRates } from "@/app/(dashboard)/settings/loyalty/actions";

const inputClass =
  "h-9 w-28 rounded-md border border-border bg-background px-2.5 text-right text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none nums";

export function LoyaltyRates({
  id,
  pointsPerUnit,
  pointValueMinor,
  expiryDays,
  referralPoints,
}: {
  id: number;
  pointsPerUnit: number;
  pointValueMinor: number;
  expiryDays: number;
  referralPoints: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [perUnit, setPerUnit] = useState(String(pointsPerUnit ?? 0));
  const [valueLe, setValueLe] = useState((Number(pointValueMinor ?? 0) / 100).toFixed(2));
  const [expiry, setExpiry] = useState(String(expiryDays ?? 0));
  const [referral, setReferral] = useState(String(referralPoints ?? 0));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    setMsg(null);
    start(async () => {
      const res = await updateLoyaltyRates(id, {
        pointsPerUnit: parseFloat(perUnit),
        pointValueLe: parseFloat(valueLe),
        expiryDays: parseInt(expiry, 10),
        referralPoints: parseInt(referral, 10),
      });
      if (res.ok) { setMsg({ ok: true, text: "Saved" }); router.refresh(); }
      else setMsg({ ok: false, text: res.error });
    });
  }

  return (
    <div className="mt-4 space-y-3 text-sm">
      <Row label="Earn rate" suffix="points per Le 1">
        <input type="number" min={0} step="0.1" value={perUnit} onChange={(e) => setPerUnit(e.target.value)} className={inputClass} />
      </Row>
      <Row label="Point value" prefix="Le">
        <input type="number" min={0} step="0.01" value={valueLe} onChange={(e) => setValueLe(e.target.value)} className={inputClass} />
      </Row>
      <Row label="Expiry" suffix="days (0 = never)">
        <input type="number" min={0} value={expiry} onChange={(e) => setExpiry(e.target.value)} className={inputClass} />
      </Row>
      <Row label="Referral reward" suffix="points per friend's first delivery (0 = off)">
        <input type="number" min={0} value={referral} onChange={(e) => setReferral(e.target.value)} className={inputClass} />
      </Row>
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save rates"}
        </button>
        {msg ? <span className={msg.ok ? "text-sm text-success-soft-foreground" : "text-sm text-destructive"}>{msg.text}</span> : null}
      </div>
    </div>
  );
}

function Row({ label, prefix, suffix, children }: { label: string; prefix?: string; suffix?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        {prefix ? <span className="text-muted-foreground">{prefix}</span> : null}
        {children}
        {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
      </span>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { formatLe } from "@/lib/format";
import { cn } from "@/lib/utils";
import { updateLoyaltyRates } from "@/app/(dashboard)/settings/loyalty/actions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const inputClass =
  "h-9 w-28 border border-border bg-background px-2.5 text-right text-sm nums focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";

/** The basket the worked example spends. A round number the owner can map onto
 *  a real sale without doing arithmetic of their own. */
const EXAMPLE_SPEND_LE = 1000;

export function LoyaltyRates({
  id,
  pointsPerUnit,
  pointValueMinor,
  expiryDays,
  referralPoints,
  loyaltyEnabled,
}: {
  id: number;
  pointsPerUnit: number;
  pointValueMinor: number;
  expiryDays: number;
  referralPoints: number;
  loyaltyEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [perUnit, setPerUnit] = useState(String(pointsPerUnit ?? 0));
  const [valueLe, setValueLe] = useState((Number(pointValueMinor ?? 0) / 100).toFixed(2));
  const [expiry, setExpiry] = useState(String(expiryDays ?? 0));
  const [referral, setReferral] = useState(String(referralPoints ?? 0));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // The two rates only mean something multiplied: points earned per Leone,
  // times what a point is worth, is the share of every sale you give back.
  const example = useMemo(() => {
    const rate = Number.parseFloat(perUnit);
    const value = Number.parseFloat(valueLe);
    if (!Number.isFinite(rate) || !Number.isFinite(value) || rate < 0 || value < 0) return null;
    const points = rate * EXAMPLE_SPEND_LE;
    const worthMinor = Math.round(points * value * 100);
    const spendMinor = EXAMPLE_SPEND_LE * 100;
    return { points, worthMinor, spendMinor, sharePct: spendMinor > 0 ? (worthMinor / spendMinor) * 100 : 0 };
  }, [perUnit, valueLe]);

  function save() {
    setMsg(null);
    start(async () => {
      const res = await updateLoyaltyRates(id, {
        pointsPerUnit: parseFloat(perUnit),
        pointValueLe: parseFloat(valueLe),
        expiryDays: parseInt(expiry, 10),
        referralPoints: parseInt(referral, 10),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Saved." });
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  const dirty =
    perUnit !== String(pointsPerUnit ?? 0) ||
    valueLe !== (Number(pointValueMinor ?? 0) / 100).toFixed(2) ||
    expiry !== String(expiryDays ?? 0) ||
    referral !== String(referralPoints ?? 0);

  return (
    <div className="space-y-4">
      {/* The headline the old page made you work out yourself. */}
      <Card className="p-4">
        {example ? (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {dirty ? "After saving, customers get" : "Customers get"}
            </p>
            <p className="mt-1 text-2xl font-[650] tracking-[-0.3px]">
              <span className="nums">{example.sharePct.toFixed(example.sharePct % 1 === 0 ? 0 : 1)}%</span> back on every order
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Spend <span className="nums text-foreground">{formatLe(example.spendMinor)}</span> → earn{" "}
              <span className="nums text-foreground">{example.points.toLocaleString()}</span>{" "}
              {example.points === 1 ? "point" : "points"} → worth{" "}
              <span className="nums text-foreground">{formatLe(example.worthMinor, 2)}</span> off a later order.
            </p>
            {!loyaltyEnabled ? (
              <p className="mt-3 border-t border-accent pt-3 text-[13px] text-warning">
                Points are switched off, so nothing is being earned right now. These rates apply the moment you turn them
                back on.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">Enter an earn rate and a point value to see what customers get.</p>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b pt-4">
          <CardTitle role="heading" aria-level={2}>Earning</CardTitle>
          <CardDescription>What a customer gets for spending, and what a point is worth when they use it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 py-4">
          <Row
            label="Earn rate"
            help="Points added for every Le 1 spent on a delivered order."
            suffix="points per Le 1"
            htmlFor="loyalty-earn-rate"
          >
            <input
              id="loyalty-earn-rate"
              type="number"
              min={0}
              step="0.1"
              value={perUnit}
              onChange={(e) => setPerUnit(e.target.value)}
              className={inputClass}
            />
          </Row>

          <Row
            label="Point value"
            help="What one point takes off the bill when a customer spends it at checkout."
            prefix="Le"
            htmlFor="loyalty-point-value"
          >
            <input
              id="loyalty-point-value"
              type="number"
              min={0}
              step="0.01"
              value={valueLe}
              onChange={(e) => setValueLe(e.target.value)}
              className={inputClass}
            />
          </Row>

          <Row
            label="Expiry"
            help="How long unused points last. Set 0 and they never expire."
            suffix="days"
            htmlFor="loyalty-expiry"
          >
            <input
              id="loyalty-expiry"
              type="number"
              min={0}
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className={inputClass}
            />
          </Row>

          <Row
            label="Referral reward"
            help="Points for both people when an invited friend's first order is delivered. Set 0 to turn referrals off."
            suffix="points"
            htmlFor="loyalty-referral"
          >
            <input
              id="loyalty-referral"
              type="number"
              min={0}
              value={referral}
              onChange={(e) => setReferral(e.target.value)}
              className={inputClass}
            />
          </Row>

          <div className="flex items-center gap-3 border-t border-accent pt-4">
            <button
              type="button"
              onClick={save}
              disabled={pending || !dirty}
              className="inline-flex h-8 items-center bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-bevel transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save rates"}
            </button>
            <span role="status" aria-live="polite" className={cn("text-[13px]", msg?.ok ? "text-success" : "text-destructive")}>
              {msg?.text ?? ""}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  help,
  prefix,
  suffix,
  htmlFor,
  children,
}: {
  label: string;
  help: string;
  prefix?: string;
  suffix?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <div className="min-w-0 flex-1">
        <label htmlFor={htmlFor} className="text-[13px] font-medium">
          {label}
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">{help}</p>
      </div>
      <span className="flex shrink-0 items-center gap-1.5">
        {prefix ? <span className="text-[13px] text-muted-foreground">{prefix}</span> : null}
        {children}
        {suffix ? <span className="w-24 text-xs text-muted-foreground">{suffix}</span> : null}
      </span>
    </div>
  );
}

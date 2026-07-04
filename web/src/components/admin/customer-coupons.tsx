"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ticket } from "@phosphor-icons/react";

import { issueCoupon } from "@/app/(dashboard)/customers/actions";

type Coupon = { code: string; discount: number; active: boolean };

export function CustomerCoupons({
  userId,
  customerName,
  coupons,
}: {
  userId: string;
  customerName: string;
  coupons: Coupon[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [percent, setPercent] = useState("10");
  const [err, setErr] = useState<string | null>(null);
  const [issued, setIssued] = useState<string | null>(null);

  function issue() {
    const n = parseInt(percent, 10);
    setErr(null);
    setIssued(null);
    start(async () => {
      const res = await issueCoupon(userId, customerName, n);
      if (res.ok) { setIssued(res.code); router.refresh(); }
      else setErr(res.error);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Coupons</h2>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={100}
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className="nums h-9 w-16 rounded-md border border-border bg-background px-2.5 text-right text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          />
          <span className="text-sm text-muted-foreground">% off</span>
        </div>
        <button
          type="button"
          onClick={issue}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          <Ticket weight="duotone" className="size-4" />
          Issue coupon
        </button>
      </div>

      {issued ? (
        <p className="mt-2 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-sm text-success-soft-foreground">
          Coupon created — give them code <span className="nums font-semibold">{issued}</span>
        </p>
      ) : null}
      {err ? <p className="mt-2 text-sm text-destructive">{err}</p> : null}

      <ul className="mt-4 divide-y divide-border border-t border-border">
        {coupons.map((c) => (
          <li key={c.code} className="flex items-center justify-between py-2.5 text-sm">
            <span className="nums font-medium">{c.code}</span>
            <span className="flex items-center gap-3 text-muted-foreground">
              <span>{c.discount}% off</span>
              <span className={c.active ? "text-success-soft-foreground" : "text-muted-foreground"}>
                {c.active ? "Active" : "Used / off"}
              </span>
            </span>
          </li>
        ))}
        {coupons.length === 0 ? <li className="py-3 text-sm text-muted-foreground">No coupons issued yet.</li> : null}
      </ul>
    </div>
  );
}

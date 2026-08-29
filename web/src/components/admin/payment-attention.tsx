import Link from "next/link";
import { WarningOctagon } from "@phosphor-icons/react/dist/ssr";

import { formatLe } from "@/lib/format";
import type { PaymentAttentionRow } from "@/lib/queries/orders";

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** The unresolved rows of the refund worklist (admin_payment_attention): staff-
 *  raised refunds still pending, plus the ones fn_confirm_monime_payment files
 *  itself when a Monime payment lands on an already-cancelled order. That
 *  second kind is why this component exists — the silent 'already_processed'
 *  no-op it replaces meant nobody found out about the 2026-08-29 incident until
 *  the customer complained. Rendered above the orders table so it can't be missed. */
export function PaymentAttention({ rows }: { rows: PaymentAttentionRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="mb-4 overflow-hidden rounded-[12px] border border-destructive/40 bg-destructive/5">
      <div className="flex items-center gap-2 border-b border-destructive/20 px-4 py-2.5">
        <WarningOctagon size={16} weight="fill" className="shrink-0 text-destructive" />
        <h2 className="text-sm font-[650] tracking-[-0.1px] text-destructive">
          {rows.length === 1 ? "1 payment needs attention" : `${rows.length} payments need attention`}
        </h2>
        <p className="text-xs text-muted-foreground">Money moved with no matching fulfilled order — each needs a refund or a re-placed order.</p>
      </div>
      <ul className="divide-y divide-destructive/15">
        {rows.map((r) => (
          <li key={r.refund_id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-xs">
            <Link href={`/orders/${r.order_id}`} className="font-medium underline underline-offset-2">
              #{r.order_number ?? r.order_id.slice(0, 8)}
            </Link>
            <span className="font-medium text-foreground">{formatLe(r.amount_minor)}</span>
            <span className="text-muted-foreground">
              paid {fmtWhen(r.requested_at)} · order {r.order_status}
              {r.intent_status ? ` · payment ${r.intent_status}` : ""}
            </span>
            {r.notes ? <span className="w-full text-muted-foreground">{r.notes}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkle } from "@phosphor-icons/react/dist/ssr";

import { formatLe } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";
import { getPosSale, getStaffNames } from "@/lib/queries/pos-sales";
import { Chip } from "@/components/admin/chip";
import { Card } from "@/components/ui/card";
import { PosVoidButton } from "@/components/admin/pos-void-button";

export const dynamic = "force-dynamic";

const PAYMENT_LABEL = { cash: "Cash", mobile_money: "Mobile money" } as const;

function fmt(ts: string | null): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{children}</h2>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="nums text-right">{children}</span>
    </div>
  );
}

export default async function PosSaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const db = createServerClient();

  const found = await getPosSale(db, id);
  if (!found) notFound();
  const { sale, items } = found;

  const names = await getStaffNames(db, [sale.cashier_id, sale.voided_by]);
  const cashier = (sale.cashier_id && names.get(sale.cashier_id)) || "Unknown";
  const voider = (sale.voided_by && names.get(sale.voided_by)) || null;
  const voided = sale.status === "voided";

  return (
    <div className="px-5 pb-6 pt-2">
      <Link href="/pos/sales" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Till sales
      </Link>

      <header className="flex items-start justify-between gap-4 py-2 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="nums text-xl font-[650] tracking-[-0.2px]">{sale.receipt_number}</h1>
            <Chip tone={voided ? "danger" : "success"}>{voided ? "Voided" : "Completed"}</Chip>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {cashier} · {fmt(sale.sold_at)} · <span className="nums">{formatLe(sale.total_minor, 2)}</span>
          </p>
        </div>
        {voided ? null : <PosVoidButton saleId={sale.id} receipt={sale.receipt_number} />}
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-4">
          <SectionLabel>Items</SectionLabel>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {items.map((it, idx) => (
              <li key={idx} className="flex items-center gap-3 py-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground ring-1 ring-border">
                  <Sparkle weight="duotone" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.product_name_snapshot}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {it.variant_label_snapshot}
                    {it.sku_snapshot ? <span className="nums"> · {it.sku_snapshot}</span> : null}
                  </p>
                </div>
                <span className="nums text-xs text-muted-foreground">
                  {it.qty} × {formatLe(it.unit_price_minor, 2)}
                </span>
                <span className="nums min-w-24 shrink-0 text-right text-sm font-medium whitespace-nowrap">{formatLe(it.line_total_minor, 2)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1.5">
            <Row label="Subtotal">{formatLe(sale.subtotal_minor, 2)}</Row>
            {sale.discount_minor > 0 ? <Row label="Discount">−{formatLe(sale.discount_minor, 2)}</Row> : null}
            <div className="flex items-baseline justify-between border-t border-border pt-2 text-sm font-semibold">
              <span>Total</span>
              <span className="nums">{formatLe(sale.total_minor, 2)}</span>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionLabel>Payment</SectionLabel>
            <div className="mt-3 space-y-1.5">
              <Row label="Method">{PAYMENT_LABEL[sale.payment_method]}</Row>
              {sale.payment_method === "mobile_money" ? <Row label="Reference">{sale.payment_reference ?? "Not recorded"}</Row> : null}
              <Row label="Cashier">{cashier}</Row>
              <Row label="Sold">{fmt(sale.sold_at)}</Row>
            </div>
          </Card>

          {voided ? (
            <Card className="border-destructive/30 p-4">
              <SectionLabel>Voided</SectionLabel>
              <div className="mt-3 space-y-1.5">
                <Row label="By">{voider ?? "Unknown"}</Row>
                <Row label="When">{fmt(sale.voided_at)}</Row>
              </div>
              <p className="mt-3 text-[13px]">{sale.void_reason}</p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

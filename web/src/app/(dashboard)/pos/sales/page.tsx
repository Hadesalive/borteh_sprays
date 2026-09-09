import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { formatInt, formatLe } from "@/lib/format";
import { listPosSales, getTodayTill, getStaffNames, POS_PAGE_SIZE } from "@/lib/queries/pos-sales";
import { ExportButton } from "@/components/admin/export-button";
import { PageHeader } from "@/components/admin/page-header";
import { PosSalesTable, type PosSaleRow } from "@/components/admin/pos-sales-table";
import type { DataTableSummaryStat } from "@/components/admin/data-table";

export const dynamic = "force-dynamic";

const PAYMENT_LABEL = { cash: "Cash", mobile_money: "Mobile money" } as const;

function fmtSold(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function PosSalesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const db = createServerClient();
  const page = Math.max(0, Number((await searchParams).page ?? "0") || 0);

  const [{ rows, total }, today] = await Promise.all([listPosSales(db, { page, pageSize: POS_PAGE_SIZE }), getTodayTill(db)]);

  const [names, itemsRes] = await Promise.all([
    getStaffNames(db, rows.map((r) => r.cashier_id)),
    rows.length
      ? db.from("pos_sale_item").select("sale_id, product_name_snapshot, qty").in("sale_id", rows.map((r) => r.id))
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (itemsRes.error) throw itemsRes.error;

  const itemsBySale = new Map<string, string[]>();
  for (const it of (itemsRes.data ?? []) as Array<{ sale_id: string; product_name_snapshot: string; qty: number }>) {
    const list = itemsBySale.get(it.sale_id) ?? [];
    list.push(it.qty > 1 ? `${it.qty}× ${it.product_name_snapshot}` : it.product_name_snapshot);
    itemsBySale.set(it.sale_id, list);
  }

  const sales: PosSaleRow[] = rows.map((r) => ({
    id: r.id,
    receipt: r.receipt_number,
    soldAt: fmtSold(r.sold_at),
    cashier: (r.cashier_id && names.get(r.cashier_id)) || "—",
    items: (itemsBySale.get(r.id) ?? []).join(", "),
    payment: PAYMENT_LABEL[r.payment_method],
    reference: r.payment_reference,
    status: r.status,
    minor: r.total_minor,
  }));

  const summary: DataTableSummaryStat[] = [
    { n: formatLe(today.total_minor), label: "taken today", tone: "text-foreground" },
    { n: formatLe(today.cash_minor), label: "cash", tone: "text-success" },
    { n: formatLe(today.mobile_money_minor), label: "mobile money", tone: "text-info" },
    { n: formatInt(today.receipts), label: "receipts", tone: "text-foreground" },
    ...(today.voided ? [{ n: formatInt(today.voided), label: "voided", tone: "text-destructive" }] : []),
  ];

  return (
    <>
      <PageHeader title="Till sales" description="Counter sales, newest first. These never enter the order queue.">
        <ExportButton
          label="Export this page"
          filename="borteh-till-sales.csv"
          headers={["Receipt", "Sold", "Cashier", "Items", "Payment", "Reference", "Status", "Total (Le)"]}
          rows={sales.map((s) => [s.receipt, s.soldAt, s.cashier, s.items, s.payment, s.reference ?? "", s.status, formatLe(s.minor, 2)])}
        />
        <Link href="/pos" className="inline-flex h-8 items-center gap-1.5 bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-bevel transition-colors hover:bg-primary/90">
          <Plus weight="duotone" className="size-4" />
          New sale
        </Link>
      </PageHeader>

      <div className="px-5 pb-6 pt-2">
        <div className="mt-4">
          <PosSalesTable sales={sales} summary={summary} page={page} total={total} />
        </div>
      </div>
    </>
  );
}

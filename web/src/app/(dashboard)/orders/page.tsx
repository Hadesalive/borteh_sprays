import { createServerClient } from "@/lib/supabase/server";
import { humanize, statusTone } from "@/components/admin/chip";
import { formatInt, formatLe } from "@/lib/format";
import { ExportButton } from "@/components/admin/export-button";
import { listOrders, getOrderStats, PAGE_SIZE } from "@/lib/queries/orders";
import { OrdersTable, type OrderRow, type SummaryStat } from "@/components/admin/orders-table";

export const dynamic = "force-dynamic";

function paymentLabel(method: string): string {
  switch (method) {
    case "cash_on_delivery": return "COD";
    case "cash": return "Cash";
    case "monime": return "Monime";
    case "card": return "Card";
    default: return method ? humanize(method) : "—";
  }
}

function fmtPlaced(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const db = createServerClient();
  const page = Math.max(0, Number((await searchParams).page ?? "0") || 0);

  // Both throw on failure; error.tsx catches and shows plain-English copy.
  const [{ rows, total }, stats] = await Promise.all([
    listOrders(db, { page, pageSize: PAGE_SIZE }),
    getOrderStats(db),
  ]);

  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean) as string[])];
  const customers = new Map<string, { name: string; phone: string }>();
  if (userIds.length > 0) {
    const { data: users } = await db.from("app_user").select("id, display_name, phone").in("id", userIds);
    for (const u of (users ?? []) as Array<{ id: string; display_name: string | null; phone: string | null }>) {
      customers.set(u.id, { name: u.display_name ?? "", phone: u.phone ?? "" });
    }
  }

  const orders: OrderRow[] = rows.map((r) => {
    const cust = customers.get(r.user_id ?? "");
    return {
      id: r.id,
      number: r.order_number ?? "",
      placed: fmtPlaced(r.placed_at ?? r.created_at),
      customer: cust?.name || "Walk-in",
      phone: cust?.phone || "—",
      channel: humanize(r.fulfillment_type ?? ""),
      payment: paymentLabel(r.payment_method ?? ""),
      status: r.status,
      statusLabel: humanize(r.status),
      statusTone: statusTone(r.status),
      minor: r.total_minor,
    };
  });

  const summary: SummaryStat[] = [
    { n: formatInt(stats.pending_count), label: "pending", tone: "text-warning" },
    { n: formatInt(stats.confirmed_count), label: "confirmed", tone: "text-info" },
    { n: formatInt(stats.out_for_delivery_count), label: "out for delivery", tone: "text-info" },
    { n: formatInt(stats.delivered_7d_count), label: "delivered · 7d", tone: "text-success" },
    { n: formatInt(stats.cancelled_count), label: "cancelled", tone: "text-destructive" },
    { n: formatLe(stats.cod_to_collect_minor), label: "COD to collect", tone: "text-foreground" },
  ];

  return (
    <div className="px-5 pb-6 pt-2">
      <div className="flex items-center justify-between py-2 pb-4">
        <div>
          <h1 className="text-xl font-[650] tracking-[-0.2px]">Orders</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Every online and counter order, newest first.
          </p>
        </div>
        <ExportButton
          label="Export this page"
          filename="borteh-orders.csv"
          headers={["Order", "Placed", "Customer", "Phone", "Channel", "Payment", "Status", "Total (Le)"]}
          rows={orders.map((o) => [`#${o.number}`, o.placed, o.customer, o.phone, o.channel, o.payment, o.statusLabel, formatLe(o.minor, 2)])}
        />
      </div>

      <OrdersTable orders={orders} summary={summary} page={page} total={total} />
    </div>
  );
}

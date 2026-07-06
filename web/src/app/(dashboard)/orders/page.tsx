import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { humanize, statusTone } from "@/components/admin/chip";
import { formatInt, formatLe } from "@/lib/format";
import { ExportButton } from "@/components/admin/export-button";
import { OrdersTable, type OrderRow, type SummaryStat } from "@/components/admin/orders-table";

export const dynamic = "force-dynamic";

const PENDING = new Set(["pending", "cod_pending"]);
const CONFIRMED = new Set(["confirmed", "preparing", "packing", "ready"]);
const OFD = new Set(["dispatched", "out_for_delivery"]);
const DELIVERED = new Set(["delivered", "completed"]);
const CANCELLED = new Set(["cancelled", "returned"]);

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

export default async function OrdersPage() {
  const db = createServerClient();

  const { data, error } = await db
    .from("order")
    .select("id, order_number, status, fulfillment_type, payment_method, total_minor, created_at, placed_at, user_id")
    .order("created_at", { ascending: false });

  const records = (data ?? []) as Record<string, unknown>[];

  // Attach customer names/phones separately (avoid relying on an embed).
  const userIds = [...new Set(records.map((r) => r.user_id as string).filter(Boolean))];
  const customers = new Map<string, { name: string; phone: string }>();
  if (userIds.length > 0) {
    const { data: users } = await db.from("app_user").select("id, display_name, phone").in("id", userIds);
    for (const u of (users ?? []) as Record<string, unknown>[]) {
      customers.set(u.id as string, {
        name: (u.display_name as string) ?? "",
        phone: (u.phone as string) ?? "",
      });
    }
  }

  const orders: OrderRow[] = records.map((r) => {
    const status = (r.status as string) ?? "pending";
    const cust = customers.get(r.user_id as string);
    return {
      id: r.id as string,
      number: (r.order_number as string) ?? "",
      placed: fmtPlaced((r.placed_at as string) ?? (r.created_at as string)),
      customer: cust?.name || "Walk-in",
      phone: cust?.phone || "—",
      channel: humanize((r.fulfillment_type as string) ?? ""),
      payment: paymentLabel((r.payment_method as string) ?? ""),
      status,
      statusLabel: humanize(status),
      statusTone: statusTone(status),
      minor: (r.total_minor as number) ?? 0,
    };
  });

  // Summary strip — live counts + COD still to collect.
  const day = 86_400_000;
  const start7 = new Date(Date.now() - 6 * day); start7.setHours(0, 0, 0, 0);
  const dateOf = (r: Record<string, unknown>) => new Date((r.placed_at as string) ?? (r.created_at as string));
  const isCod = (r: Record<string, unknown>) => String((r.payment_method as string) ?? "").includes("cash");
  const count = (set: Set<string>) => records.filter((r) => set.has((r.status as string) ?? "")).length;
  const codToCollect = records
    .filter((r) => isCod(r) && !DELIVERED.has((r.status as string) ?? "") && !CANCELLED.has((r.status as string) ?? ""))
    .reduce((s, r) => s + ((r.total_minor as number) ?? 0), 0);

  const summary: SummaryStat[] = [
    { n: formatInt(count(PENDING)), label: "pending", tone: "text-warning" },
    { n: formatInt(count(CONFIRMED)), label: "confirmed", tone: "text-info" },
    { n: formatInt(count(OFD)), label: "out for delivery", tone: "text-info" },
    { n: formatInt(records.filter((r) => DELIVERED.has((r.status as string) ?? "") && dateOf(r) >= start7).length), label: "delivered · 7d", tone: "text-success" },
    { n: formatInt(count(CANCELLED)), label: "cancelled", tone: "text-destructive" },
    { n: formatLe(codToCollect), label: "COD to collect", tone: "text-foreground" },
  ];

  return (
    <div className="px-5 pb-6 pt-2">
      <div className="flex items-center justify-between py-2 pb-4">
        <div>
          <h1 className="text-xl font-[650] tracking-[-0.2px]">Orders</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {error ? "Couldn't load orders — check the Supabase keys in web/.env.local." : "Every online and counter order, newest first."}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            filename="borteh-orders.csv"
            headers={["Order", "Placed", "Customer", "Phone", "Channel", "Payment", "Status", "Total (Le)"]}
            rows={orders.map((o) => [`#${o.number}`, o.placed, o.customer, o.phone, o.channel, o.payment, o.statusLabel, formatLe(o.minor, 2)])}
          />
          <Link href="/orders/new" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(0,0,0,0.25),0_1px_0_rgba(26,26,26,0.07)] transition-colors hover:bg-[#1a1917]">
            <Plus weight="duotone" className="size-4" />
            New order
          </Link>
        </div>
      </div>

      <OrdersTable orders={orders} summary={summary} />
    </div>
  );
}

import Link from "next/link";
import { DownloadSimple, Plus } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";
import { formatInt, formatLe, formatPct } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";
import { getOverviewStats, getOverviewPanels } from "@/lib/queries/overview";
import { listOrders } from "@/lib/queries/orders";
import { Chip, humanize, statusTone } from "@/components/admin/chip";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function paymentLabel(method: string | null): string {
  switch (method) {
    case "cash_on_delivery": return "COD";
    case "cash": return "Cash";
    case "monime": return "Monime";
    case "card": return "Card";
    default: return method ? humanize(method) : "—";
  }
}

function Delta({ ratio }: { ratio: number }) {
  if (!isFinite(ratio) || ratio === 0) {
    return <span className="nums text-xs font-medium text-muted-foreground">—</span>;
  }
  const up = ratio > 0;
  return (
    <span className={cn("nums text-xs font-medium", up ? "text-success" : "text-destructive")}>
      {up ? "▲" : "▼"} {formatPct(Math.abs(ratio), 1)}
    </span>
  );
}

const cardHead = "flex items-baseline justify-between";
const cardTitle = "text-[13px] font-semibold";
const cardLink = "text-xs font-medium text-brand hover:underline";
const rowLine = "flex items-center gap-2 h-9 border-t border-accent text-[13px] first:border-t-0";

export default async function OverviewPage() {
  const db = createServerClient();
  const [stats, panels, { rows: recent }] = await Promise.all([
    getOverviewStats(db),
    getOverviewPanels(db),
    listOrders(db, { page: 0, pageSize: 8 }),
  ]);

  // Bounded name lookup for just these 8 rows — panels.queue.customer_name only
  // covers active orders, not recent orders of any status.
  const recentUserIds = [...new Set(recent.map((o) => o.user_id).filter(Boolean) as string[])];
  const recentNames = new Map<string, string>();
  if (recentUserIds.length > 0) {
    const { data: users } = await db.from("app_user").select("id, display_name").in("id", recentUserIds);
    for (const u of (users ?? []) as Array<{ id: string; display_name: string | null }>) {
      recentNames.set(u.id, u.display_name ?? "");
    }
  }

  const ratio = (now: number, prev: number) => (prev === 0 ? 0 : (now - prev) / prev);

  const revenueDelta = ratio(stats.revenue_7d_minor, stats.revenue_prev_7d_minor);
  const deliveredRate =
    stats.orders_7d === 0 ? 0 : stats.delivered_7d_count / stats.orders_7d;
  const perOrder = stats.orders_7d === 0 ? 0 : stats.items_sold_7d / stats.orders_7d;
  const topMax = Math.max(...panels.topSellers.map((t) => t.revenue_minor), 1);

  const revenue7d = panels.revenueDaily.map((d) => d.revenue_minor);
  const dayLabels = panels.revenueDaily.map((d) =>
    new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(d.day)),
  );

  const queueTotal = panels.queue.reduce((s, o) => s + (o.total_minor ?? 0), 0);

  return (
    <div className="px-5 pb-6 pt-2">
      {/* Header */}
      <div className="flex items-start justify-between">
        <header className="py-2 pb-6">
          <h1 className="text-xl font-[650] tracking-[-0.2px]">Overview</h1>
          <p className="mt-4 nums text-[2.75rem] leading-none font-semibold tracking-[-0.02em]">
            {formatLe(stats.revenue_today_minor)}
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>taken today</span>
            <Delta ratio={revenueDelta} />
            <span>vs the previous 7 days</span>
          </p>
        </header>
        <div className="flex gap-2 pt-2">
          <Link href="/analytics" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium shadow-card transition-colors hover:bg-muted">
            <DownloadSimple weight="duotone" className="size-4" />
            Reports
          </Link>
          <Link href="/pos" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-bevel transition-colors hover:bg-[#1a1917]">
            <Plus weight="duotone" className="size-4" />
            Open POS
          </Link>
        </div>
      </div>

      {/* Chart */}
      <Card className="p-4">
        <div className={cardHead}>
          <span className={cardTitle}>Revenue</span>
          <span className="nums text-xs text-muted-foreground">Last 7 days · {formatLe(stats.revenue_7d_minor)}</span>
        </div>
        <RevenueChart data={revenue7d} labels={dayLabels} />
        <div className="mt-3 flex items-center gap-4 border-t border-accent pt-3 text-xs text-muted-foreground">
          <span className="nums">{formatInt(stats.orders_7d)} orders</span>
          <span className="nums">{perOrder.toFixed(1)} items / order</span>
          <span className="nums">{formatPct(deliveredRate)} delivered</span>
        </div>
      </Card>

      {/* Live queue + Low stock */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="p-4">
          <div className={cardHead}>
            <span className={cardTitle}>Live queue</span>
            <Link href="/orders" className={cardLink}>All orders</Link>
          </div>
          <div className="mt-1">
            {panels.queue.length ? panels.queue.map((o) => (
              <div key={o.id} className={rowLine}>
                <span className="nums font-medium">#{o.order_number ?? "—"}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{o.customer_name}</span>
                <Chip tone={statusTone(o.status)}>{humanize(o.status)}</Chip>
                <span className="nums font-medium">{formatLe(o.total_minor ?? 0, 2)}</span>
              </div>
            )) : <p className="py-3 text-[13px] text-muted-foreground">Queue is clear.</p>}
          </div>
          {panels.queue.length > 0 && (
            <div className="mt-3 flex items-center justify-between border-t border-accent pt-3 text-xs">
              <span className="font-semibold text-muted-foreground">In the queue</span>
              <span className="nums font-medium">{panels.queue.length} active · {formatLe(queueTotal)}</span>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className={cardHead}>
            <span className={cardTitle}>Low stock</span>
            <Link href="/inventory" className={cardLink}>Inventory</Link>
          </div>
          {panels.lowStock.length ? panels.lowStock.map((r, i) => (
            <div key={i} className={rowLine}>
              <span className="min-w-0 flex-1 truncate">{r.product_name} <span className="text-[#B5B2AC]">{r.size_ml} ml</span></span>
              <span className={cn("nums text-xs font-medium", r.qty_available <= 0 ? "text-destructive" : "text-warning")}>{r.qty_available <= 0 ? "Out" : r.qty_available}</span>
            </div>
          )) : <p className="py-2 text-[13px] text-muted-foreground">Everything in stock.</p>}
        </Card>
      </div>

      {/* Top sellers + Restock demand */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="p-4">
          <div className={cardHead}>
            <span className={cardTitle}>Top sellers · 7d</span>
            <Link href="/analytics" className={cardLink}>Reports</Link>
          </div>
          {panels.topSellers.length ? panels.topSellers.map((t, i) => (
            <div key={i} className={rowLine}>
              <span className="w-[190px] shrink-0 truncate">{t.product_name} <span className="text-[#B5B2AC]">{t.variant_label}</span></span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-accent">
                <div className="h-full rounded-sm bg-brand" style={{ width: `${(t.revenue_minor / topMax) * 100}%` }} />
              </div>
              <span className="nums w-[100px] text-right font-medium">{formatLe(t.revenue_minor, 2)}</span>
            </div>
          )) : <p className="py-2 text-[13px] text-muted-foreground">No sales yet.</p>}
        </Card>

        <Card className="p-4">
          <div className={cardHead}>
            <span className={cardTitle}>Restock demand</span>
          </div>
          {panels.restockDemand.length ? panels.restockDemand.map((r, i) => (
            <div key={i} className={rowLine}>
              <span className="min-w-0 flex-1 truncate">{r.product_name} <span className="text-[#B5B2AC]">{r.size_ml} ml</span></span>
              <span className="nums font-medium">{r.subscriber_count} <span className="font-normal text-[#B5B2AC]">waiting</span></span>
            </div>
          )) : <p className="py-2 text-[13px] text-muted-foreground">No one waiting.</p>}
        </Card>
      </div>

      {/* Recent orders */}
      <Card className="mt-4 p-4">
        <div className={cardHead}>
          <span className={cardTitle}>Recent orders</span>
          <Link href="/orders" className={cardLink}>View all</Link>
        </div>
        <table className="mt-1 w-full border-collapse text-[13px]">
          <tbody>
            {recent.length ? recent.map((o) => (
              <tr key={o.id} className="h-9 border-t border-accent">
                <td className="nums w-14 py-1.5 pr-3 font-medium">#{o.order_number ?? "—"}</td>
                <td className="px-3 py-1.5">{recentNames.get(o.user_id ?? "") || "Walk-in"}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{paymentLabel(o.payment_method)}</td>
                <td className="px-3 py-1.5"><Chip tone={statusTone(o.status)}>{humanize(o.status)}</Chip></td>
                <td className="nums py-1.5 text-right font-medium">{formatLe(o.total_minor ?? 0, 2)}</td>
              </tr>
            )) : (
              <tr><td className="py-3 text-muted-foreground">No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

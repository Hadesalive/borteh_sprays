import { cn } from "@/lib/utils";
import { formatInt, formatLe, formatPct } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { ExportButton } from "@/components/admin/export-button";

export const dynamic = "force-dynamic";

const CANCELLED = new Set(["cancelled", "returned"]);
const PAST_PENDING = new Set(["confirmed", "preparing", "packing", "ready", "dispatched", "out_for_delivery", "delivered", "completed"]);
const DELIVERED = new Set(["delivered", "completed"]);

const card = "rounded-[12px] border border-border bg-card shadow-[0_1px_0_rgba(26,26,26,0.07)]";
const cardHead = "flex items-baseline justify-between";
const cardTitle = "text-[13px] font-semibold";
const rowLine = "flex items-center gap-2 h-9 border-t border-accent text-[13px] first:border-t-0";

function Delta({ ratio }: { ratio: number }) {
  if (!isFinite(ratio) || ratio === 0) return <span className="nums text-xs text-muted-foreground">—</span>;
  const up = ratio > 0;
  return <span className={cn("nums text-xs font-medium", up ? "text-success" : "text-destructive")}>{up ? "▲" : "▼"} {formatPct(Math.abs(ratio), 1)}</span>;
}

export default async function AnalyticsPage() {
  const db = createServerClient();
  const [ordersRes, itemsRes] = await Promise.all([
    db.from("order").select("total_minor, status, payment_method, placed_at, created_at"),
    db.from("order_item").select("product_name_snapshot, variant_label_snapshot, qty, line_total_minor, created_at"),
  ]);

  const orders = (ordersRes.data ?? []) as Array<{ total_minor: number; status: string; payment_method: string | null; placed_at: string | null; created_at: string }>;
  const items = (itemsRes.data ?? []) as Array<{ product_name_snapshot: string; variant_label_snapshot: string | null; qty: number; line_total_minor: number; created_at: string }>;

  const now = new Date();
  const day = 86_400_000;
  const start7 = new Date(now.getTime() - 6 * day); start7.setHours(0, 0, 0, 0);
  const startPrev = new Date(now.getTime() - 13 * day); startPrev.setHours(0, 0, 0, 0);
  const dateOf = (o: { placed_at: string | null; created_at: string }) => new Date(o.placed_at ?? o.created_at);

  const live = orders.filter((o) => !CANCELLED.has(o.status));
  const last7 = live.filter((o) => dateOf(o) >= start7);
  const prev7 = live.filter((o) => dateOf(o) >= startPrev && dateOf(o) < start7);

  const rev7 = last7.reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const revPrev = prev7.reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const orders7 = last7.length;
  const ordersPrev = prev7.length;
  const avg7 = orders7 ? Math.round(rev7 / orders7) : 0;
  const avgPrev = ordersPrev ? Math.round(revPrev / ordersPrev) : 0;
  const revRatio = revPrev ? (rev7 - revPrev) / revPrev : 0;
  const ordersRatio = ordersPrev ? (orders7 - ordersPrev) / ordersPrev : 0;
  const avgRatio = avgPrev ? (avg7 - avgPrev) / avgPrev : 0;

  const items7 = items.filter((it) => new Date(it.created_at) >= start7);
  const itemBase = items7.length ? items7 : items;
  const itemsSold = itemBase.reduce((s, it) => s + (it.qty ?? 0), 0);
  const perOrder = orders7 ? itemsSold / orders7 : 0;

  const delivered7 = last7.filter((o) => DELIVERED.has(o.status)).length;
  const deliveredRate = orders7 ? delivered7 / orders7 : 0;
  const cancelled7 = orders.filter((o) => CANCELLED.has(o.status) && dateOf(o) >= start7).length;
  const cancelRate = orders7 + cancelled7 ? cancelled7 / (orders7 + cancelled7) : 0;

  // Revenue by day.
  const revenue: number[] = [];
  const labels: string[] = [];
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short" });
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * day);
    const key = d.toDateString();
    revenue.push(last7.filter((o) => dateOf(o).toDateString() === key).reduce((s, o) => s + (o.total_minor ?? 0), 0));
    labels.push(wd.format(d));
  }

  // Order funnel.
  const confirmed = last7.filter((o) => PAST_PENDING.has(o.status)).length;
  const funnel = [
    { stage: "Placed", count: orders7 },
    { stage: "Confirmed", count: confirmed },
    { stage: "Delivered", count: delivered7 },
  ];
  const funnelTop = funnel[0].count || 1;

  // Best sellers.
  const byProduct = new Map<string, { meta: string; units: number; minor: number }>();
  for (const it of itemBase) {
    const cur = byProduct.get(it.product_name_snapshot) ?? { meta: it.variant_label_snapshot ?? "", units: 0, minor: 0 };
    cur.units += it.qty ?? 0;
    cur.minor += it.line_total_minor ?? 0;
    byProduct.set(it.product_name_snapshot, cur);
  }
  const bestTotal = [...byProduct.values()].reduce((s, v) => s + v.minor, 0) || 1;
  const best = [...byProduct.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.minor - a.minor).slice(0, 6);
  const bestMax = Math.max(...best.map((b) => b.minor), 1);

  // Payment mix.
  const codMinor = last7.filter((o) => String(o.payment_method ?? "").includes("cash")).reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const prepaidMinor = rev7 - codMinor;
  const codShare = rev7 ? codMinor / rev7 : 0;

  const stats: Array<{ label: string; value: string; delta: React.ReactNode }> = [
    { label: "Revenue · 7d", value: formatLe(rev7), delta: <Delta ratio={revRatio} /> },
    { label: "Orders", value: formatInt(orders7), delta: <Delta ratio={ordersRatio} /> },
    { label: "Avg order", value: formatLe(avg7), delta: <Delta ratio={avgRatio} /> },
    { label: "Items sold", value: formatInt(itemsSold), delta: <span className="nums text-xs text-muted-foreground">{perOrder.toFixed(1)} / order</span> },
    { label: "Delivered", value: formatPct(deliveredRate), delta: <span className="nums text-xs text-muted-foreground">{delivered7} of {orders7}</span> },
    { label: "Cancelled", value: formatInt(cancelled7), delta: <span className="nums text-xs text-muted-foreground">{formatPct(cancelRate, 1)}</span> },
  ];

  return (
    <div className="px-5 pb-6 pt-2">
      <div className="flex items-center justify-between py-2 pb-4">
        <div>
          <h1 className="text-xl font-[650] tracking-[-0.2px]">Reports</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Live · in-house, no third-party tracking.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-muted-foreground">Last 7 days</span>
          <ExportButton
            filename="borteh-best-sellers.csv"
            label="Export CSV"
            headers={["Product", "Variant", "Units", "Revenue (Le)", "Share"]}
            rows={best.map((b) => [b.name, b.meta, b.units, formatLe(b.minor, 2), formatPct(b.minor / bestTotal, 1)])}
          />
        </div>
      </div>

      {/* Stats */}
      <div className={cn(card, "flex flex-wrap gap-y-3 p-4")}>
        {stats.map((s) => (
          <div key={s.label} className="mr-5 border-r border-accent pr-5 last:mr-0 last:border-0 last:pr-0">
            <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="nums text-xl font-[650] leading-tight tracking-[-0.2px]">{s.value}</span>
              {s.delta}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue + Payment mix */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className={cn(card, "p-4")}>
          <div className={cardHead}>
            <span className={cardTitle}>Revenue by day · vs last week</span>
            <span className="nums text-xs text-muted-foreground">{formatLe(rev7)} vs {formatLe(revPrev)}</span>
          </div>
          <RevenueChart data={revenue} labels={labels} />
        </div>

        <div className={cn(card, "p-4")}>
          <span className={cardTitle}>Payment mix</span>
          <div className="mt-3 flex h-2 overflow-hidden rounded-sm">
            <div className="bg-foreground" style={{ width: `${codShare * 100}%` }} />
            <div className="bg-[#B5B2AC]" style={{ width: `${(1 - codShare) * 100}%` }} />
          </div>
          <div className="mt-3 flex flex-col gap-1 text-[13px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Cash &amp; COD</span><span className="nums font-medium">{formatLe(codMinor)} · {formatPct(codShare)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Prepaid</span><span className="nums font-medium">{formatLe(prepaidMinor)} · {formatPct(1 - codShare)}</span></div>
          </div>
          <div className="mt-4 flex flex-col gap-1 border-t border-accent pt-3 text-[13px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Delivered rate</span><span className="nums font-medium">{formatPct(deliveredRate)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Cancellation rate</span><span className="nums font-medium">{formatPct(cancelRate, 1)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Avg order value</span><span className="nums font-medium">{formatLe(avg7, 2)}</span></div>
          </div>
        </div>
      </div>

      {/* Funnel + Best sellers bars */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className={cn(card, "p-4")}>
          <span className={cardTitle}>Order funnel</span>
          <div className="mt-3 flex flex-col gap-3">
            {funnel.map((f, i) => {
              const pct = f.count / funnelTop;
              const drop = i === 0 ? null : funnel[i - 1].count ? 1 - f.count / funnel[i - 1].count : 0;
              return (
                <div key={f.stage}>
                  <div className="flex justify-between text-[13px]">
                    <span>{f.stage}</span>
                    <span className="nums"><span className="font-medium">{formatInt(f.count)}</span> {drop !== null ? <span className="text-[#B5B2AC]">−{formatPct(drop)}</span> : null}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-accent">
                    <div className={cn("h-full rounded-sm", i === funnel.length - 1 ? "bg-success" : "bg-brand")} style={{ width: `${pct * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={cn(card, "p-4")}>
          <span className={cardTitle}>Best sellers · 7d</span>
          <div className="mt-2">
            {best.length ? best.map((b) => (
              <div key={b.name} className={rowLine}>
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                <div className="h-1.5 w-16 overflow-hidden rounded-sm bg-accent">
                  <div className="h-full rounded-sm bg-brand" style={{ width: `${(b.minor / bestMax) * 100}%` }} />
                </div>
                <span className="nums w-20 text-right font-medium">{formatLe(b.minor, 2)}</span>
              </div>
            )) : <p className="py-2 text-[13px] text-muted-foreground">No sales yet.</p>}
          </div>
        </div>
      </div>

      {/* Best sellers table */}
      <div className={cn(card, "mt-4 overflow-hidden")}>
        <div className="border-b border-border px-4 py-2.5 text-[13px] font-semibold">Best sellers</div>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-1.5 pl-4 text-left text-xs font-medium text-muted-foreground">Product</th>
              <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">Units</th>
              <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">Revenue</th>
              <th className="px-3 py-1.5 pr-4 text-right text-xs font-medium text-muted-foreground">Share</th>
            </tr>
          </thead>
          <tbody>
            {best.length ? best.map((b) => (
              <tr key={b.name} className="border-t border-accent">
                <td className="py-1.5 pl-4 pr-3 font-medium">{b.name} <span className="font-normal text-[#B5B2AC]">{b.meta}</span></td>
                <td className="nums px-3 py-1.5 text-right">{formatInt(b.units)}</td>
                <td className="nums px-3 py-1.5 text-right font-medium">{formatLe(b.minor, 2)}</td>
                <td className="nums px-3 py-1.5 pr-4 text-right text-muted-foreground">{formatPct(b.minor / bestTotal, 1)}</td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="px-4 py-16 text-center text-muted-foreground">No sales yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

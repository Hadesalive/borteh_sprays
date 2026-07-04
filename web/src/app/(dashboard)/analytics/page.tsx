import { cn } from "@/lib/utils";
import { formatInt, formatLe, formatPct } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import { RevenueAreaChart, type RevenuePoint } from "@/components/dashboard/revenue-area-chart";

export const dynamic = "force-dynamic";

const CANCELLED = new Set(["cancelled", "returned"]);
const PAST_PENDING = new Set(["confirmed", "preparing", "ready", "out_for_delivery", "delivered"]);

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{children}</h2>;
}

export default async function AnalyticsPage() {
  const db = createServerClient();
  const [ordersRes, itemsRes] = await Promise.all([
    db.from("order").select("total_minor, status, payment_method, placed_at, created_at"),
    db.from("order_item").select("product_name_snapshot, qty, line_total_minor"),
  ]);

  const orders = (ordersRes.data ?? []) as Array<{ total_minor: number; status: string; payment_method: string | null; placed_at: string | null; created_at: string }>;
  const items = (itemsRes.data ?? []) as Array<{ product_name_snapshot: string; qty: number; line_total_minor: number }>;

  const live = orders.filter((o) => !CANCELLED.has(o.status));
  const revenue = live.reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const orderCount = live.length;
  const avg = orderCount ? Math.round(revenue / orderCount) : 0;
  const itemsSold = items.reduce((s, i) => s + (i.qty ?? 0), 0);

  const kpis = [
    { label: "Revenue", value: formatLe(revenue, 2) },
    { label: "Orders", value: formatInt(orderCount) },
    { label: "Avg. order", value: formatLe(avg, 2) },
    { label: "Items sold", value: formatInt(itemsSold) },
  ];

  // Revenue by day, last 7 days.
  const days: RevenuePoint[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toDateString();
    const minor = live
      .filter((o) => new Date(o.placed_at ?? o.created_at).toDateString() === key)
      .reduce((s, o) => s + (o.total_minor ?? 0), 0);
    days.push({ label: d.toLocaleDateString("en-GB", { weekday: "short" }), minor });
  }

  // Order funnel (real statuses).
  const confirmed = live.filter((o) => PAST_PENDING.has(o.status)).length;
  const delivered = live.filter((o) => o.status === "delivered").length;
  const funnel = [
    { stage: "Placed", count: orderCount },
    { stage: "Confirmed", count: confirmed },
    { stage: "Delivered", count: delivered },
  ];
  const top = funnel[0].count || 1;

  // Best sellers from order items.
  const byProduct = new Map<string, { units: number; minor: number }>();
  for (const it of items) {
    const cur = byProduct.get(it.product_name_snapshot) ?? { units: 0, minor: 0 };
    cur.units += it.qty ?? 0;
    cur.minor += it.line_total_minor ?? 0;
    byProduct.set(it.product_name_snapshot, cur);
  }
  const best = [...byProduct.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.minor - a.minor)
    .slice(0, 5);

  // Payment mix.
  const cod = live.filter((o) => String(o.payment_method ?? "").includes("cash")).length;
  const prepaid = orderCount - cod;
  const payment = [
    { label: "Cash & COD", share: orderCount ? cod / orderCount : 0, dot: "bg-foreground" },
    { label: "Prepaid", share: orderCount ? prepaid / orderCount : 0, dot: "bg-primary" },
  ].filter((p) => p.share > 0);

  return (
    <>
      <PageHeader title="Analytics" description="Live · in-house, no third-party tracking." />

      <div className="mx-auto max-w-[1100px] px-6 py-8 lg:px-10">
        <div className="grid grid-cols-2 divide-x divide-y divide-border border border-border sm:grid-cols-4 sm:divide-y-0">
          {kpis.map((k) => (
            <div key={k.label} className="px-5 py-4">
              <p className="text-sm text-muted-foreground">{k.label}</p>
              <p className="nums mt-1 text-2xl font-semibold tracking-tight">{k.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <SectionLabel>Revenue · last 7 days</SectionLabel>
          <div className="mt-4">
            <RevenueAreaChart data={days} className="max-h-72" />
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <SectionLabel>Order funnel</SectionLabel>
            <ul className="mt-5 space-y-4">
              {funnel.map((f, i) => {
                const pct = f.count / top;
                const drop = i === 0 ? null : funnel[i - 1].count ? 1 - f.count / funnel[i - 1].count : 0;
                return (
                  <li key={f.stage}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{f.stage}</span>
                      <span className="flex items-baseline gap-3">
                        <span className="nums font-semibold">{formatInt(f.count)}</span>
                        {drop !== null ? (
                          <span className="nums w-14 text-right text-xs text-muted-foreground">−{formatPct(drop)}</span>
                        ) : (
                          <span className="w-14" />
                        )}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", i === funnel.length - 1 ? "bg-success" : "bg-primary")} style={{ width: `${pct * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="lg:border-l lg:border-border lg:pl-10">
            <SectionLabel>Best sellers</SectionLabel>
            <ul className="mt-4 space-y-3.5">
              {best.map((p) => (
                <li key={p.name} className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground ring-1 ring-border">
                    <Sparkle weight="duotone" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                  <span className="nums text-sm font-semibold">{formatLe(p.minor, 2)}</span>
                </li>
              ))}
              {best.length === 0 ? <li className="text-sm text-muted-foreground">No sales yet.</li> : null}
            </ul>

            {payment.length ? (
              <div className="mt-8">
                <SectionLabel>Payment mix</SectionLabel>
                <div className="mt-4 flex h-2 gap-1 overflow-hidden">
                  {payment.map((p) => (
                    <div key={p.label} className={cn("rounded-full", p.dot)} style={{ flexGrow: p.share * 100 }} />
                  ))}
                </div>
                <ul className="mt-3 space-y-2">
                  {payment.map((p) => (
                    <li key={p.label} className="flex items-center gap-2.5 text-sm">
                      <span className={cn("size-2.5 shrink-0 rounded-full", p.dot)} />
                      <span className="flex-1">{p.label}</span>
                      <span className="nums font-semibold">{formatPct(p.share)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

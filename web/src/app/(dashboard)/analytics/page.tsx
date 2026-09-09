import { cn } from "@/lib/utils";
import { formatInt, formatLe, formatPct } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { PaymentMixChart } from "@/components/admin/payment-mix-chart";
import { OrderFunnelChart } from "@/components/admin/order-funnel-chart";
import { BestSellersChart } from "@/components/admin/best-sellers-chart";
import { ExportButton } from "@/components/admin/export-button";

export const dynamic = "force-dynamic";

const CANCELLED = new Set(["cancelled", "returned"]);
const PAST_PENDING = new Set(["confirmed", "preparing", "packing", "ready", "dispatched", "out_for_delivery", "delivered", "completed"]);
const DELIVERED = new Set(["delivered", "completed"]);

function Delta({ ratio }: { ratio: number }) {
  if (!isFinite(ratio) || ratio === 0) return <span className="nums text-xs text-muted-foreground">—</span>;
  const up = ratio > 0;
  return <span className={cn("nums text-xs font-medium", up ? "text-success" : "text-destructive")}>{up ? "▲" : "▼"} {formatPct(Math.abs(ratio), 1)}</span>;
}

type BestSellerRow = { name: string; meta: string; units: number; minor: number };

export default async function AnalyticsPage() {
  const db = createServerClient();
  const now = new Date();
  const day = 86_400_000;
  const start7 = new Date(now.getTime() - 6 * day); start7.setHours(0, 0, 0, 0);
  const startPrev = new Date(now.getTime() - 13 * day); startPrev.setHours(0, 0, 0, 0);

  const [ordersRes, itemsRes, salesRes] = await Promise.all([
    db.from("order").select("total_minor, status, payment_method, placed_at, created_at"),
    db.from("order_item").select("product_name_snapshot, variant_label_snapshot, qty, line_total_minor, created_at"),
    // Till sales: completed receipts from the last two weeks (this week + the comparison week).
    db.from("pos_sale").select("id, total_minor, sold_at").eq("status", "completed").gte("sold_at", startPrev.toISOString()),
  ]);
  if (ordersRes.error) throw ordersRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (salesRes.error) throw salesRes.error;

  const orders = (ordersRes.data ?? []) as Array<{ total_minor: number; status: string; payment_method: string | null; placed_at: string | null; created_at: string }>;
  const items = (itemsRes.data ?? []) as Array<{ product_name_snapshot: string; variant_label_snapshot: string | null; qty: number; line_total_minor: number; created_at: string }>;
  const sales = (salesRes.data ?? []) as Array<{ id: string; total_minor: number; sold_at: string }>;

  const { data: saleItemRows, error: saleItemsError } = sales.length
    ? await db.from("pos_sale_item").select("sale_id, product_name_snapshot, variant_label_snapshot, qty, line_total_minor").in("sale_id", sales.map((s) => s.id))
    : { data: [], error: null };
  if (saleItemsError) throw saleItemsError;
  const soldAtBySale = new Map(sales.map((s) => [s.id, s.sold_at]));
  const saleItems = ((saleItemRows ?? []) as Array<{ sale_id: string; product_name_snapshot: string; variant_label_snapshot: string | null; qty: number; line_total_minor: number }>)
    .map((it) => ({ ...it, created_at: soldAtBySale.get(it.sale_id) ?? "" }));

  const dateOf = (o: { placed_at: string | null; created_at: string }) => new Date(o.placed_at ?? o.created_at);

  const live = orders.filter((o) => !CANCELLED.has(o.status));
  const last7 = live.filter((o) => dateOf(o) >= start7);
  const prev7 = live.filter((o) => dateOf(o) >= startPrev && dateOf(o) < start7);
  const sales7 = sales.filter((s) => new Date(s.sold_at) >= start7);
  const salesPrev = sales.filter((s) => new Date(s.sold_at) < start7);

  // Revenue is both channels together; the app/till split feeds the gauge.
  const appRev7 = last7.reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const tillRev7 = sales7.reduce((s, x) => s + (x.total_minor ?? 0), 0);
  const rev7 = appRev7 + tillRev7;
  const revPrev = prev7.reduce((s, o) => s + (o.total_minor ?? 0), 0) + salesPrev.reduce((s, x) => s + (x.total_minor ?? 0), 0);
  const orders7 = last7.length;
  const ordersPrev = prev7.length;
  const sales7Count = orders7 + sales7.length;
  const salesPrevCount = ordersPrev + salesPrev.length;
  const avg7 = sales7Count ? Math.round(rev7 / sales7Count) : 0;
  const avgPrev = salesPrevCount ? Math.round(revPrev / salesPrevCount) : 0;
  const revRatio = revPrev ? (rev7 - revPrev) / revPrev : 0;
  const ordersRatio = salesPrevCount ? (sales7Count - salesPrevCount) / salesPrevCount : 0;
  const avgRatio = avgPrev ? (avg7 - avgPrev) / avgPrev : 0;

  const orderItems7 = items.filter((it) => new Date(it.created_at) >= start7);
  const saleItems7 = saleItems.filter((it) => new Date(it.created_at) >= start7);
  const items7 = [...orderItems7, ...saleItems7];
  // Quiet week: fall back to all-time app items so best sellers still shows something.
  const itemBase = items7.length ? items7 : items;
  const itemsSold = itemBase.reduce((s, it) => s + (it.qty ?? 0), 0);
  const perOrder = sales7Count ? itemsSold / sales7Count : 0;

  const delivered7 = last7.filter((o) => DELIVERED.has(o.status)).length;
  const deliveredRate = orders7 ? delivered7 / orders7 : 0;
  const cancelled7 = orders.filter((o) => CANCELLED.has(o.status) && dateOf(o) >= start7).length;
  const cancelRate = orders7 + cancelled7 ? cancelled7 / (orders7 + cancelled7) : 0;

  // Revenue by day — this week, plus the same weekday last week for the
  // chart's comparison line.
  const revenue: number[] = [];
  const revenuePrev: number[] = [];
  const labels: string[] = [];
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short" });
  const sumOn = (rows: typeof live, till: typeof sales, key: string) =>
    rows.filter((o) => dateOf(o).toDateString() === key).reduce((s, o) => s + (o.total_minor ?? 0), 0) +
    till.filter((x) => new Date(x.sold_at).toDateString() === key).reduce((s, x) => s + (x.total_minor ?? 0), 0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * day);
    revenue.push(sumOn(last7, sales7, d.toDateString()));
    revenuePrev.push(sumOn(prev7, salesPrev, new Date(d.getTime() - 7 * day).toDateString()));
    labels.push(wd.format(d));
  }

  // Order funnel.
  const confirmed = last7.filter((o) => PAST_PENDING.has(o.status)).length;
  const funnel = [
    { stage: "Placed", count: orders7 },
    { stage: "Confirmed", count: confirmed },
    { stage: "Delivered", count: delivered7 },
  ];

  // Best sellers.
  const byProduct = new Map<string, { meta: string; units: number; minor: number }>();
  for (const it of itemBase) {
    const cur = byProduct.get(it.product_name_snapshot) ?? { meta: it.variant_label_snapshot ?? "", units: 0, minor: 0 };
    cur.units += it.qty ?? 0;
    cur.minor += it.line_total_minor ?? 0;
    byProduct.set(it.product_name_snapshot, cur);
  }
  const bestTotal = [...byProduct.values()].reduce((s, v) => s + v.minor, 0) || 1;
  const best: BestSellerRow[] = [...byProduct.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.minor - a.minor).slice(0, 6);

  // Channel split, plus how app orders were paid.
  const appShare = rev7 ? appRev7 / rev7 : 0;
  const codMinor = last7.filter((o) => String(o.payment_method ?? "").includes("cash")).reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const monimeMinor = appRev7 - codMinor;

  const stats: Array<{ label: string; value: string; delta: React.ReactNode }> = [
    { label: "Revenue · 7d", value: formatLe(rev7), delta: <Delta ratio={revRatio} /> },
    { label: "Sales", value: formatInt(sales7Count), delta: <Delta ratio={ordersRatio} /> },
    { label: "Avg sale", value: formatLe(avg7), delta: <Delta ratio={avgRatio} /> },
    { label: "Items sold", value: formatInt(itemsSold), delta: <span className="nums text-xs text-muted-foreground">{perOrder.toFixed(1)} / sale</span> },
    { label: "Delivered", value: formatPct(deliveredRate), delta: <span className="nums text-xs text-muted-foreground">{delivered7} of {orders7}</span> },
    { label: "Cancelled", value: formatInt(cancelled7), delta: <span className="nums text-xs text-muted-foreground">{formatPct(cancelRate, 1)}</span> },
  ];

  const bestSellersColumns: DataTableColumn<BestSellerRow>[] = [
    {
      header: "Product",
      render: (b) => (
        <>
          {b.name} <span className="font-normal text-muted-foreground">{b.meta}</span>
        </>
      ),
    },
    { header: "Units", align: "right", render: (b) => <span className="nums">{formatInt(b.units)}</span> },
    { header: "Revenue", align: "right", render: (b) => <span className="nums font-medium">{formatLe(b.minor, 2)}</span> },
    { header: "Share", align: "right", render: (b) => <span className="nums text-muted-foreground">{formatPct(b.minor / bestTotal, 1)}</span> },
  ];

  return (
    <>
      <PageHeader title="Analytics" description="Live · in-house, no third-party tracking.">
        <span className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-muted-foreground">Last 7 days</span>
        <ExportButton
          filename="borteh-best-sellers.csv"
          label="Export CSV"
          headers={["Product", "Variant", "Units", "Revenue (Le)", "Share"]}
          rows={best.map((b) => [b.name, b.meta, b.units, formatLe(b.minor, 2), formatPct(b.minor / bestTotal, 1)])}
        />
      </PageHeader>

      <div className="px-5 pb-6 pt-2">
        {/* Stats */}
        <Card className="flex flex-wrap gap-y-3 p-4">
          {stats.map((s) => (
            <div key={s.label} className="mr-5 border-r border-accent pr-5 last:mr-0 last:border-0 last:pr-0">
              <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="nums text-xl font-[650] leading-tight tracking-[-0.2px]">{s.value}</span>
                {s.delta}
              </div>
            </div>
          ))}
        </Card>

        {/* Revenue + Payment mix */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card className="overflow-hidden p-0">
            <CardHeader className="border-b pt-4">
              <CardTitle role="heading" aria-level={2}>Revenue by day</CardTitle>
              <CardDescription>vs last week: {formatLe(rev7)} vs {formatLe(revPrev)}</CardDescription>
            </CardHeader>
            <CardContent className="py-4">
              <RevenueChart data={revenue} labels={labels} previous={revenuePrev} />
            </CardContent>
          </Card>

          <Card className="overflow-hidden p-0">
            <CardHeader className="border-b pt-4">
              <CardTitle role="heading" aria-level={2}>Revenue by channel</CardTitle>
            </CardHeader>
            <CardContent className="py-4">
              {rev7 > 0 ? (
                <>
                  <PaymentMixChart appMinor={appRev7} tillMinor={tillRev7} />
                  {/* Swatches mirror PaymentMixChart's chartConfig colors (chart-1 / chart-3). */}
                  <div className="mt-3 flex flex-col gap-1 text-[13px]">
                    <div className="flex justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground"><span aria-hidden className="size-2 shrink-0 rounded-full bg-chart-1" />App orders</span>
                      <span className="nums font-medium">{formatLe(appRev7)} · {formatPct(appShare)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground"><span aria-hidden className="size-2 shrink-0 rounded-full bg-chart-3" />Till sales</span>
                      <span className="nums font-medium">{formatLe(tillRev7)} · {formatPct(1 - appShare)}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-1 border-t border-accent pt-3 text-[13px]">
                    <div className="flex justify-between"><span className="text-muted-foreground">App · cash on delivery</span><span className="nums font-medium">{formatLe(codMinor)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">App · Monime</span><span className="nums font-medium">{formatLe(monimeMinor)}</span></div>
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-muted-foreground">No sales yet.</p>
              )}
              <div className="mt-4 flex flex-col gap-1 border-t border-accent pt-3 text-[13px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Delivered rate</span><span className="nums font-medium">{formatPct(deliveredRate)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cancellation rate</span><span className="nums font-medium">{formatPct(cancelRate, 1)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Avg sale</span><span className="nums font-medium">{formatLe(avg7, 2)}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Funnel + Best sellers chart */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card className="overflow-hidden p-0">
            <CardHeader className="border-b pt-4">
              <CardTitle role="heading" aria-level={2}>Order funnel</CardTitle>
              <CardDescription>App orders only — a till sale has no journey to track.</CardDescription>
            </CardHeader>
            <CardContent className="py-4">
              {orders7 > 0 ? (
                <>
                  <OrderFunnelChart stages={funnel} />
                  {/* Counts are on the bars; this row carries the stage-to-stage drop-off. */}
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-accent pt-3 text-xs text-muted-foreground">
                    {funnel.slice(1).map((f, i) => {
                      const prev = funnel[i].count;
                      const drop = prev ? 1 - f.count / prev : 0;
                      return (
                        <span key={f.stage} className="nums">
                          {funnel[i].stage} → {f.stage}{" "}
                          <span className={cn("font-medium", drop > 0 ? "text-destructive" : "text-foreground")}>−{formatPct(drop)}</span>
                        </span>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-muted-foreground">No sales yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden p-0">
            <CardHeader className="border-b pt-4">
              <CardTitle role="heading" aria-level={2}>Best sellers · 7d · both channels</CardTitle>
            </CardHeader>
            <CardContent className="py-4">
              {best.length ? <BestSellersChart items={best} /> : <p className="text-[13px] text-muted-foreground">No sales yet.</p>}
            </CardContent>
          </Card>
        </div>

        {/* Best sellers table */}
        <div className="mt-4">
          <DataTable columns={bestSellersColumns} rows={best} rowKey={(b) => b.name} empty="No sales yet." />
        </div>
      </div>
    </>
  );
}

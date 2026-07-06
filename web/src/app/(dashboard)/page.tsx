import Link from "next/link";
import { DownloadSimple, Plus } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";
import { formatInt, formatLe, formatPct } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";
import { Chip, humanize, statusTone } from "@/components/admin/chip";
import { RevenueChart } from "@/components/admin/revenue-chart";

export const dynamic = "force-dynamic";

const CANCELLED = new Set(["cancelled", "returned"]);
const CLOSED = new Set(["delivered", "completed", "cancelled", "returned"]);
const DELIVERED = new Set(["delivered", "completed"]);

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

// Card chrome — 12px radius, hairline border, whisper-thin drop shadow (design v5).
const card = "rounded-[12px] border border-border bg-card shadow-[0_1px_0_rgba(26,26,26,0.07)]";
const cardHead = "flex items-baseline justify-between";
const cardTitle = "text-[13px] font-semibold";
const cardLink = "text-xs font-medium text-brand hover:underline";
const rowLine = "flex items-center gap-2 h-9 border-t border-accent text-[13px] first:border-t-0";

export default async function OverviewPage() {
  const db = createServerClient();
  const now = new Date();
  const day = 86_400_000;
  const start7 = new Date(now.getTime() - 6 * day); start7.setHours(0, 0, 0, 0);
  const startPrev = new Date(now.getTime() - 13 * day); startPrev.setHours(0, 0, 0, 0);
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);

  const [ordersRes, itemsRes, invRes, restockRes] = await Promise.all([
    db.from("order").select("id, order_number, total_minor, status, payment_method, fulfillment_type, placed_at, created_at, user_id").order("created_at", { ascending: false }),
    db.from("order_item").select("product_name_snapshot, variant_label_snapshot, qty, line_total_minor, created_at"),
    db.from("inventory_item").select("qty_available, reorder_point, variant_id, product_variant(size_ml, product(name))"),
    db.from("restock_subscription").select("variant_id").eq("status", "active"),
  ]);

  type Order = { id: string; order_number: string | null; total_minor: number; status: string; payment_method: string | null; fulfillment_type: string | null; placed_at: string | null; created_at: string; user_id: string | null };
  const orders = (ordersRes.data ?? []) as Order[];
  const items = (itemsRes.data ?? []) as Array<{ product_name_snapshot: string; variant_label_snapshot: string | null; qty: number; line_total_minor: number; created_at: string }>;
  const inv = (invRes.data ?? []) as unknown as Array<{ qty_available: number; reorder_point: number; variant_id: string; product_variant: { size_ml: number | null; product: { name: string } | null } | null }>;
  const restock = (restockRes.data ?? []) as Array<{ variant_id: string }>;

  // Customer names for the queue / recent-orders cards.
  const userIds = [...new Set(orders.map((o) => o.user_id).filter(Boolean) as string[])];
  const names = new Map<string, string>();
  if (userIds.length) {
    const { data: users } = await db.from("app_user").select("id, display_name").in("id", userIds);
    for (const u of (users ?? []) as Array<{ id: string; display_name: string | null }>) {
      names.set(u.id, u.display_name ?? "");
    }
  }
  const nameOf = (o: Order) => (o.user_id && names.get(o.user_id)) || "Walk-in";

  const live = orders.filter((o) => !CANCELLED.has(o.status));
  const dateOf = (o: Order) => new Date(o.placed_at ?? o.created_at);
  const last7 = live.filter((o) => dateOf(o) >= start7);
  const prev7 = live.filter((o) => dateOf(o) >= startPrev && dateOf(o) < start7);
  const today = live.filter((o) => dateOf(o) >= startToday);

  const rev7 = last7.reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const revPrev = prev7.reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const revToday = today.reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const orders7 = last7.length;
  const ordersPrev = prev7.length;
  const avg7 = orders7 ? Math.round(rev7 / orders7) : 0;
  const avgPrev = ordersPrev ? Math.round(revPrev / ordersPrev) : 0;
  const revRatio = revPrev ? (rev7 - revPrev) / revPrev : 0;
  const ordersRatio = ordersPrev ? (orders7 - ordersPrev) / ordersPrev : 0;
  const avgRatio = avgPrev ? (avg7 - avgPrev) / avgPrev : 0;

  const revenue7d: number[] = [];
  const dayLabels: string[] = [];
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short" });
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * day);
    const key = d.toDateString();
    revenue7d.push(last7.filter((o) => dateOf(o).toDateString() === key).reduce((s, o) => s + (o.total_minor ?? 0), 0));
    dayLabels.push(wd.format(d));
  }

  // Items sold + top sellers, scoped to the last 7 days (fall back to all-time if unstamped).
  const items7 = items.filter((it) => new Date(it.created_at) >= start7);
  const itemBase = items7.length ? items7 : items;
  const itemsSold = itemBase.reduce((s, it) => s + (it.qty ?? 0), 0);
  const perOrder = orders7 ? itemsSold / orders7 : 0;
  const byProduct = new Map<string, { meta: string; minor: number }>();
  for (const it of itemBase) {
    const cur = byProduct.get(it.product_name_snapshot) ?? { meta: it.variant_label_snapshot ?? "", minor: 0 };
    cur.minor += it.line_total_minor ?? 0;
    byProduct.set(it.product_name_snapshot, cur);
  }
  const topSellers = [...byProduct.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.minor - a.minor).slice(0, 5);
  const topMax = Math.max(...topSellers.map((t) => t.minor), 1);

  // Fulfilment / delivered (7 days).
  const delivered7 = last7.filter((o) => DELIVERED.has(o.status)).length;
  const deliveredRate = orders7 ? delivered7 / orders7 : 0;

  // Inventory — low stock + restock demand, with names.
  const invByVariant = new Map(inv.map((r) => [r.variant_id, r] as const));
  const labelFor = (r: (typeof inv)[number]) => {
    const n = r.product_variant?.product?.name ?? "Item";
    const sz = r.product_variant?.size_ml != null ? `${r.product_variant.size_ml} ml` : "";
    return { name: n, meta: sz };
  };
  const lowRows = inv
    .filter((r) => (r.qty_available ?? 0) <= (r.reorder_point ?? 0))
    .sort((a, b) => (a.qty_available ?? 0) - (b.qty_available ?? 0))
    .slice(0, 4)
    .map((r) => ({ ...labelFor(r), qty: r.qty_available ?? 0 }));
  const lowStock = inv.filter((r) => (r.qty_available ?? 0) <= (r.reorder_point ?? 0)).length;
  const outCount = inv.filter((r) => (r.qty_available ?? 0) <= 0).length;

  const restockByVariant = new Map<string, number>();
  for (const r of restock) restockByVariant.set(r.variant_id, (restockByVariant.get(r.variant_id) ?? 0) + 1);
  const restockRows = [...restockByVariant.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([vid, count]) => {
      const iv = invByVariant.get(vid);
      return { ...(iv ? labelFor(iv) : { name: "Item", meta: "" }), count };
    });
  const waiting = restock.length;

  // Live queue — active (not closed) orders, newest first.
  const queue = live.filter((o) => !CLOSED.has(o.status)).slice(0, 5);
  const queueTotal = queue.reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const recent = orders.slice(0, 5);

  // Channel & payment mix (last 7 days).
  const isCod = (o: Order) => String(o.payment_method ?? "").includes("cash") || o.payment_method === "cash_on_delivery";
  const deliveryCount = last7.filter((o) => o.fulfillment_type === "delivery").length;
  const pickupCount = orders7 - deliveryCount;
  const codMinor = last7.filter(isCod).reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const prepaidMinor = rev7 - codMinor;
  const mix = [
    { label: "Delivery", value: `${deliveryCount} · ${formatPct(orders7 ? deliveryCount / orders7 : 0)}`, pct: orders7 ? deliveryCount / orders7 : 0, bar: "bg-brand" },
    { label: "Pickup", value: `${pickupCount} · ${formatPct(orders7 ? pickupCount / orders7 : 0)}`, pct: orders7 ? pickupCount / orders7 : 0, bar: "bg-[#B5B2AC]" },
    { label: "COD + cash", value: `${formatLe(codMinor)} · ${formatPct(rev7 ? codMinor / rev7 : 0)}`, pct: rev7 ? codMinor / rev7 : 0, bar: "bg-foreground" },
    { label: "Prepaid", value: `${formatLe(prepaidMinor)} · ${formatPct(rev7 ? prepaidMinor / rev7 : 0)}`, pct: rev7 ? prepaidMinor / rev7 : 0, bar: "bg-[#B5B2AC]" },
  ];

  const dateLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(now);
  const codToConfirm = live.filter((o) => isCod(o) && (o.status === "pending" || o.status === "cod_pending")).length;

  const stats: Array<{ label: string; value: string; delta: React.ReactNode }> = [
    { label: "Revenue · 7d", value: formatLe(rev7), delta: <Delta ratio={revRatio} /> },
    { label: "Orders", value: formatInt(orders7), delta: <Delta ratio={ordersRatio} /> },
    { label: "Avg order", value: formatLe(avg7), delta: <Delta ratio={avgRatio} /> },
    { label: "Items sold", value: formatInt(itemsSold), delta: <span className="nums text-xs text-muted-foreground">{perOrder.toFixed(1)} / order</span> },
    { label: "Delivered", value: formatPct(deliveredRate), delta: <span className="nums text-xs text-muted-foreground">{delivered7} of {orders7}</span> },
    { label: "Low stock", value: formatInt(lowStock), delta: <span className="nums text-xs font-medium text-destructive">{outCount} out · {waiting} waiting</span> },
  ];

  return (
    <div className="px-5 pb-6 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between py-2 pb-4">
        <div>
          <h1 className="text-xl font-[650] tracking-[-0.2px]">Dashboard</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {dateLabel} · {formatLe(revToday)} so far today
            {codToConfirm > 0 && <> · <span className="font-medium text-warning">{codToConfirm} COD to confirm</span></>}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/analytics" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium shadow-[0_1px_0_rgba(26,26,26,0.07)] transition-colors hover:bg-muted">
            <DownloadSimple weight="duotone" className="size-4" />
            Reports
          </Link>
          <Link href="/pos" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(0,0,0,0.25),0_1px_0_rgba(26,26,26,0.07)] transition-colors hover:bg-[#1a1917]">
            <Plus weight="duotone" className="size-4" />
            Open POS
          </Link>
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

      {/* Chart + Live queue */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className={cn(card, "p-4")}>
          <div className={cardHead}>
            <span className={cardTitle}>Revenue</span>
            <span className="nums text-xs text-muted-foreground">Last 7 days · {formatLe(rev7)}</span>
          </div>
          <RevenueChart data={revenue7d} labels={dayLabels} />
        </div>

        <div className={cn(card, "p-4")}>
          <div className={cardHead}>
            <span className={cardTitle}>Live queue</span>
            <Link href="/orders" className={cardLink}>All orders</Link>
          </div>
          <div className="mt-1">
            {queue.length ? queue.map((o) => (
              <div key={o.id} className={rowLine}>
                <span className="nums font-medium">#{o.order_number ?? "—"}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{nameOf(o)}</span>
                <Chip tone={statusTone(o.status)}>{humanize(o.status)}</Chip>
                <span className="nums font-medium">{formatLe(o.total_minor ?? 0, 2)}</span>
              </div>
            )) : <p className="py-3 text-[13px] text-muted-foreground">Queue is clear.</p>}
          </div>
          {queue.length > 0 && (
            <div className="mt-3 flex items-center justify-between border-t border-accent pt-3 text-xs">
              <span className="font-semibold text-muted-foreground">In the queue</span>
              <span className="nums font-medium">{queue.length} active · {formatLe(queueTotal)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent orders + Low stock */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className={cn(card, "px-4 pb-3 pt-2")}>
          <div className={cn(cardHead, "py-2")}>
            <span className={cardTitle}>Recent orders</span>
            <Link href="/orders" className={cardLink}>View all</Link>
          </div>
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {recent.length ? recent.map((o) => (
                <tr key={o.id} className="h-9 border-t border-accent">
                  <td className="nums w-14 py-1.5 pr-3 font-medium">#{o.order_number ?? "—"}</td>
                  <td className="px-3 py-1.5">{nameOf(o)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{paymentLabel(o.payment_method)}</td>
                  <td className="px-3 py-1.5"><Chip tone={statusTone(o.status)}>{humanize(o.status)}</Chip></td>
                  <td className="nums py-1.5 text-right font-medium">{formatLe(o.total_minor ?? 0, 2)}</td>
                </tr>
              )) : (
                <tr><td className="py-3 text-muted-foreground">No orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={cn(card, "px-4 pb-3 pt-2")}>
          <div className={cn(cardHead, "py-2")}>
            <span className={cardTitle}>Low stock</span>
            <Link href="/inventory" className={cardLink}>Inventory</Link>
          </div>
          {lowRows.length ? lowRows.map((r, i) => (
            <div key={i} className={rowLine}>
              <span className="min-w-0 flex-1 truncate">{r.name} <span className="text-[#B5B2AC]">{r.meta}</span></span>
              <span className={cn("nums text-xs font-medium", r.qty <= 0 ? "text-destructive" : "text-warning")}>{r.qty <= 0 ? "Out" : r.qty}</span>
            </div>
          )) : <p className="py-2 text-[13px] text-muted-foreground">Everything in stock.</p>}

          <div className="flex items-baseline justify-between pb-2 pt-3">
            <span className="text-xs font-semibold text-muted-foreground">Restock demand</span>
          </div>
          {restockRows.length ? restockRows.map((r, i) => (
            <div key={i} className={rowLine}>
              <span className="min-w-0 flex-1 truncate">{r.name} <span className="text-[#B5B2AC]">{r.meta}</span></span>
              <span className="nums font-medium">{r.count} <span className="font-normal text-[#B5B2AC]">waiting</span></span>
            </div>
          )) : <p className="py-2 text-[13px] text-muted-foreground">No one waiting.</p>}
        </div>
      </div>

      {/* Top sellers + Mix */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className={cn(card, "px-4 pb-3 pt-2")}>
          <div className={cn(cardHead, "py-2")}>
            <span className={cardTitle}>Top sellers · 7d</span>
            <Link href="/analytics" className={cardLink}>Reports</Link>
          </div>
          {topSellers.length ? topSellers.map((t) => (
            <div key={t.name} className={rowLine}>
              <span className="w-[190px] shrink-0 truncate">{t.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-accent">
                <div className="h-full rounded-sm bg-brand" style={{ width: `${(t.minor / topMax) * 100}%` }} />
              </div>
              <span className="nums w-[100px] text-right font-medium">{formatLe(t.minor, 2)}</span>
            </div>
          )) : <p className="py-2 text-[13px] text-muted-foreground">No sales yet.</p>}
        </div>

        <div className={cn(card, "px-4 pb-3 pt-2")}>
          <div className="py-2"><span className={cardTitle}>Channel &amp; payment</span></div>
          {mix.map((m) => (
            <div key={m.label} className={rowLine}>
              <span className="w-[104px] shrink-0">{m.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-accent">
                <div className={cn("h-full rounded-sm", m.bar)} style={{ width: `${m.pct * 100}%` }} />
              </div>
              <span className="nums w-[104px] text-right text-xs text-muted-foreground">{m.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  DownloadSimple,
  Minus,
  Plus,
  Sparkle,
  TrendDown,
  TrendUp,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";
import { delta, formatInt, formatLe, formatPct } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CANCELLED = new Set(["cancelled", "returned"]);
const DISPATCHABLE = new Set(["confirmed", "preparing", "ready"]);

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function DeltaPill({ ratio }: { ratio: number }) {
  const d = delta(ratio);
  const Icon = d.direction === "up" ? TrendUp : d.direction === "down" ? TrendDown : Minus;
  return (
    <span className={cn("nums inline-flex items-center gap-1 text-sm font-medium", d.direction === "up" && "text-success-soft-foreground", d.direction === "down" && "text-destructive", d.direction === "flat" && "text-muted-foreground")}>
      <Icon weight="duotone" className="size-4" />
      {d.label}
    </span>
  );
}

function Sparkline({ points, className }: { points: number[]; className?: string }) {
  const W = 200, H = 56, pad = 4;
  const max = Math.max(...points, 0);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const stepX = (W - pad * 2) / Math.max(points.length - 1, 1);
  const xy = points.map((v, i) => ({ x: pad + i * stepX, y: pad + (H - pad * 2) - ((v - min) / span) * (H - pad * 2) }));
  let line = `M ${xy[0].x.toFixed(1)} ${xy[0].y.toFixed(1)}`;
  for (let i = 1; i < xy.length; i++) {
    const xMid = (xy[i - 1].x + xy[i].x) / 2;
    const yMid = (xy[i - 1].y + xy[i].y) / 2;
    line += ` Q ${xy[i - 1].x.toFixed(1)} ${xy[i - 1].y.toFixed(1)} ${xMid.toFixed(1)} ${yMid.toFixed(1)}`;
  }
  const last = xy[xy.length - 1];
  line += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  const area = `${line} L ${last.x.toFixed(1)} ${H - pad} L ${xy[0].x.toFixed(1)} ${H - pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className={cn("text-primary", className)}>
      <defs>
        <linearGradient id="hero-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#hero-spark)" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last.x} cy={last.y} r={3} fill="currentColor" />
    </svg>
  );
}

const toneText: Record<string, string> = {
  warning: "text-warning-soft-foreground",
  info: "text-info-soft-foreground",
  danger: "text-destructive",
  muted: "text-muted-foreground",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{children}</h2>;
}

export default async function OverviewPage() {
  const db = createServerClient();
  const now = new Date();
  const day = 86_400_000;
  const start7 = new Date(now.getTime() - 6 * day); start7.setHours(0, 0, 0, 0);
  const startPrev = new Date(now.getTime() - 13 * day); startPrev.setHours(0, 0, 0, 0);

  const [ordersRes, itemsRes, invRes, restockRes] = await Promise.all([
    db.from("order").select("total_minor, status, payment_method, fulfillment_type, placed_at, created_at"),
    db.from("order_item").select("product_name_snapshot, variant_label_snapshot, qty, line_total_minor"),
    db.from("inventory_item").select("qty_available, reorder_point"),
    db.from("restock_subscription").select("id", { count: "exact", head: true }),
  ]);

  const orders = (ordersRes.data ?? []) as Array<{ total_minor: number; status: string; payment_method: string | null; fulfillment_type: string | null; placed_at: string | null; created_at: string }>;
  const items = (itemsRes.data ?? []) as Array<{ product_name_snapshot: string; variant_label_snapshot: string | null; qty: number; line_total_minor: number }>;
  const inv = (invRes.data ?? []) as Array<{ qty_available: number; reorder_point: number }>;

  const live = orders.filter((o) => !CANCELLED.has(o.status));
  const dateOf = (o: { placed_at: string | null; created_at: string }) => new Date(o.placed_at ?? o.created_at);
  const last7 = live.filter((o) => dateOf(o) >= start7);
  const prev7 = live.filter((o) => dateOf(o) >= startPrev && dateOf(o) < start7);

  const rev7 = last7.reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const revPrev = prev7.reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const ratio = revPrev ? (rev7 - revPrev) / revPrev : 0;
  const orders7 = last7.length;
  const deliveryShare = orders7 ? last7.filter((o) => o.fulfillment_type === "delivery").length / orders7 : 0;
  const avg7 = orders7 ? Math.round(rev7 / orders7) : 0;

  const revenue7d: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * day);
    const key = d.toDateString();
    revenue7d.push(last7.filter((o) => dateOf(o).toDateString() === key).reduce((s, o) => s + (o.total_minor ?? 0), 0));
  }

  const isCod = (o: { payment_method: string | null }) => String(o.payment_method ?? "").includes("cash");
  const codPending = live.filter((o) => isCod(o) && o.status !== "delivered").length;
  const readyDispatch = live.filter((o) => o.fulfillment_type === "delivery" && DISPATCHABLE.has(o.status)).length;
  const lowStock = inv.filter((r) => (r.qty_available ?? 0) <= (r.reorder_point ?? 0)).length;
  const restockers = restockRes.count ?? 0;

  const attention = [
    { count: codPending, tone: "warning" as const, title: "COD orders to handle", meta: "Confirm and dispatch", href: "/orders" },
    { count: readyDispatch, tone: "info" as const, title: "Ready to dispatch", meta: "Delivery orders awaiting a rider", href: "/dispatch" },
    { count: lowStock, tone: "danger" as const, title: "Low on stock", meta: "Variants at or below their threshold", href: "/inventory" },
    { count: restockers, tone: "muted" as const, title: "Restock subscribers", meta: "Waiting on availability", href: "/inventory" },
  ].filter((a) => a.count > 0);

  const byProduct = new Map<string, { meta: string; minor: number }>();
  for (const it of items) {
    const cur = byProduct.get(it.product_name_snapshot) ?? { meta: it.variant_label_snapshot ?? "", minor: 0 };
    cur.minor += it.line_total_minor ?? 0;
    byProduct.set(it.product_name_snapshot, cur);
  }
  const topSellers = [...byProduct.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.minor - a.minor).slice(0, 4);

  const allCount = live.length;
  const codCount = live.filter(isCod).length;
  const codMinor = live.filter(isCod).reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const prepaidMinor = live.filter((o) => !isCod(o)).reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const totalMinor = codMinor + prepaidMinor || 1;
  const payRows = [
    { label: "Cash & COD", minor: codMinor, share: codMinor / totalMinor, dot: "bg-foreground" },
    { label: "Prepaid", minor: prepaidMinor, share: prepaidMinor / totalMinor, dot: "bg-primary" },
  ].filter((r) => r.minor > 0);

  const deliveredRate = allCount ? live.filter((o) => o.status === "delivered").length / allCount : 0;
  const codShare = allCount ? codCount / allCount : 0;

  const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(now);
  const secondary = [
    { value: formatInt(orders7), label: "orders" },
    { value: formatPct(deliveryShare), label: "delivery" },
    { value: formatLe(avg7, 2), label: "avg order" },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 lg:px-10 lg:py-10">
      {/* Hero */}
      <header>
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-muted-foreground">{dateLabel} · {greeting(now.getHours())}, Mr. Borteh</p>
          <div className="flex items-center gap-2">
            <Link href="/analytics" className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
              <DownloadSimple weight="duotone" className="size-4" />
              Reports
            </Link>
            <Link href="/pos" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
              <Plus weight="duotone" className="size-4" />
              New sale
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-4">
          <p className="nums text-5xl font-semibold tracking-tight">{formatLe(rev7, 2)}</p>
          <Sparkline points={revenue7d} className="mb-1 h-12 w-36" />
          <DeltaPill ratio={ratio} />
        </div>

        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {secondary.map((s, i) => (
            <span key={s.label} className="flex items-center gap-3">
              {i > 0 && <span aria-hidden className="text-border">·</span>}
              <span><span className="nums font-semibold text-foreground">{s.value}</span> {s.label}</span>
            </span>
          ))}
          <span className="flex items-center gap-3">
            <span aria-hidden className="text-border">·</span>
            <span>last 7 days</span>
          </span>
        </p>
      </header>

      <div className="my-8 border-t border-border" />

      <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        {/* Needs you */}
        <section>
          <SectionLabel>Needs you</SectionLabel>
          {attention.length ? (
            <ul className="mt-4 divide-y divide-border">
              {attention.map((a) => (
                <li key={a.title}>
                  <Link href={a.href} className="group -mx-2 flex items-center gap-4 rounded-md px-2 py-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
                    <span className={cn("nums w-9 shrink-0 text-2xl font-semibold tabular-nums", toneText[a.tone])}>{a.count}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{a.title}</span>
                      <span className="block text-sm text-muted-foreground">{a.meta}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">All clear — nothing needs you right now.</p>
          )}
          <Link href="/orders" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            All orders
            <ArrowRight className="size-3.5" />
          </Link>
        </section>

        {/* Pulse */}
        <section className="lg:border-l lg:border-border lg:pl-10">
          <SectionLabel>Pulse</SectionLabel>

          {payRows.length ? (
            <div className="mt-4">
              <div className="flex h-2 gap-1 overflow-hidden">
                {payRows.map((r) => <div key={r.label} className={cn("rounded-full", r.dot)} style={{ flexGrow: r.share * 100 }} />)}
              </div>
              <ul className="mt-3 space-y-2">
                {payRows.map((row) => (
                  <li key={row.label} className="flex items-center gap-2.5 text-sm">
                    <span className={cn("size-2.5 shrink-0 rounded-full", row.dot)} />
                    <span className="flex-1">{row.label}</span>
                    <span className="nums font-semibold">{formatLe(row.minor, 2)}</span>
                    <span className="nums w-9 text-right text-muted-foreground">{formatPct(row.share)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8">
            <SectionLabel>Top sellers</SectionLabel>
            <ul className="mt-4 space-y-3.5">
              {topSellers.map((p) => (
                <li key={p.name} className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground ring-1 ring-border">
                    <Sparkle weight="duotone" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    {p.meta ? <span className="block truncate text-xs text-muted-foreground">{p.meta}</span> : null}
                  </span>
                  <span className="nums text-sm font-semibold">{formatLe(p.minor, 2)}</span>
                </li>
              ))}
              {topSellers.length === 0 ? <li className="text-sm text-muted-foreground">No sales yet.</li> : null}
            </ul>
          </div>

          <div className="mt-8 space-y-3">
            <SectionLabel>Fulfilment</SectionLabel>
            {[
              { label: "Delivered rate", value: deliveredRate },
              { label: "COD share", value: codShare },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="nums font-semibold">{formatPct(m.value)}</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-success" style={{ width: `${m.value * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

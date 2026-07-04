import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { formatInt, formatLe } from "@/lib/format";
import { StatusPill, type PillTone } from "@/components/admin/status-pill";
import { CustomerActions } from "@/components/admin/customer-actions";
import { CustomerLoyalty } from "@/components/admin/customer-loyalty";
import { CustomerCoupons } from "@/components/admin/customer-coupons";

export const dynamic = "force-dynamic";

const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function statusTone(status: string): PillTone {
  if (status === "delivered") return "success";
  if (status === "cancelled" || status === "returned") return "danger";
  if (status === "pending_payment") return "warning";
  return "info";
}

function fmtDate(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createServerClient();

  const { data: customer } = await db
    .from("app_user")
    .select("id, display_name, phone, email, role, is_blocked, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!customer) notFound();

  const name = (customer.display_name as string)?.trim() || "Unnamed customer";

  const [ordersRes, acctRes, tiersRes, couponsRes, ledgerRes] = await Promise.all([
    db.from("order").select("id, order_number, status, total_minor, created_at").eq("user_id", id).order("created_at", { ascending: false }),
    db.from("loyalty_account").select("points_balance, current_tier_id").eq("user_id", id).maybeSingle(),
    db.from("loyalty_tier").select("id, name, discount_percent").eq("is_active", true).order("rank", { ascending: true }),
    db.from("promo_code").select("code, discount_value, is_active").eq("description", `Issued to ${name}`).order("created_at", { ascending: false }),
    db.from("loyalty_ledger").select("delta, type, reason, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(8),
  ]);

  const orders = (ordersRes.data ?? []) as Array<{ id: string; order_number: string; status: string; total_minor: number; created_at: string }>;
  const spent = orders.filter((o) => o.status !== "cancelled" && o.status !== "returned").reduce((s, o) => s + (o.total_minor ?? 0), 0);
  const points = (acctRes.data?.points_balance as number) ?? 0;
  const currentTierId = (acctRes.data?.current_tier_id as string | null) ?? null;
  const tiers = (tiersRes.data ?? []).map((t) => ({ id: t.id as string, name: t.name as string, discount: Number(t.discount_percent ?? 0) }));
  const coupons = (couponsRes.data ?? []).map((c) => ({ code: c.code as string, discount: c.discount_value as number, active: c.is_active as boolean }));
  const ledger = (ledgerRes.data ?? []) as Array<{ delta: number; type: string; reason: string | null; created_at: string }>;

  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Customers
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{initials}</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
                <StatusPill tone={customer.is_blocked ? "danger" : "neutral"}>{customer.is_blocked ? "Blocked" : humanize(customer.role as string)}</StatusPill>
              </div>
              <p className="nums text-sm text-muted-foreground">
                {[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact"} · joined {fmtDate(customer.created_at as string)}
              </p>
            </div>
          </div>
          <CustomerActions id={customer.id as string} blocked={(customer.is_blocked as boolean) ?? false} name={name} />
        </div>

        <div className="mt-5 flex flex-wrap gap-x-10 gap-y-2">
          <div><p className="nums text-2xl font-semibold tracking-tight">{formatInt(orders.length)}</p><p className="text-xs text-muted-foreground">orders</p></div>
          <div><p className="nums text-2xl font-semibold tracking-tight">{formatLe(spent, 2)}</p><p className="text-xs text-muted-foreground">total spent</p></div>
          <div><p className="nums text-2xl font-semibold tracking-tight">{formatInt(points)}</p><p className="text-xs text-muted-foreground">points</p></div>
        </div>
      </div>

      <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.5fr_1fr] lg:px-10">
        {/* Transaction history */}
        <section>
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Transaction history</h2>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex items-center gap-3 py-3 transition-colors hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="nums truncate text-sm font-medium">#{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</p>
                  </div>
                  <StatusPill tone={statusTone(o.status)} dot>{humanize(o.status)}</StatusPill>
                  <span className="nums w-24 text-right text-sm font-semibold">{formatLe(o.total_minor, 2)}</span>
                </Link>
              </li>
            ))}
            {orders.length === 0 ? <li className="py-6 text-sm text-muted-foreground">No orders yet.</li> : null}
          </ul>

          {ledger.length ? (
            <>
              <h2 className="mt-8 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Points history</h2>
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {ledger.map((l, i) => (
                  <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{l.reason || humanize(l.type)}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(l.created_at)}</span>
                    <span className={`nums ml-4 w-14 text-right font-semibold ${l.delta >= 0 ? "text-success-soft-foreground" : "text-destructive"}`}>
                      {l.delta >= 0 ? "+" : ""}{formatInt(l.delta)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        {/* Loyalty + coupons */}
        <div className="space-y-6">
          <CustomerLoyalty userId={customer.id as string} points={points} currentTierId={currentTierId} tiers={tiers} />
          <CustomerCoupons userId={customer.id as string} customerName={name} coupons={coupons} />
        </div>
      </div>
    </>
  );
}

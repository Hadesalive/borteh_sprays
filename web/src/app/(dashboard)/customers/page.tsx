import Link from "next/link";
import { UsersThree } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { StatusPill, type PillTone } from "@/components/admin/status-pill";
import { CustomerActions } from "@/components/admin/customer-actions";
import { formatInt, formatLe } from "@/lib/format";

export const dynamic = "force-dynamic";

type Customer = {
  id: string;
  name: string;
  contact: string;
  orders: number;
  spent: number;
  blocked: boolean;
  points: number;
  last: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function loyaltyTier(points: number, blocked: boolean): { label: string; tone: PillTone } {
  if (blocked) return { label: "Blocked", tone: "danger" };
  if (points >= 500) return { label: "Gold", tone: "warning" };
  if (points >= 100) return { label: "Silver", tone: "neutral" };
  return { label: "Member", tone: "info" };
}

function lastOrderLabel(iso: string | null): string {
  if (!iso) return "No orders";
  const then = new Date(iso);
  const now = new Date();
  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate();
  if (sameDay) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const wasYesterday =
    then.getFullYear() === yesterday.getFullYear() &&
    then.getMonth() === yesterday.getMonth() &&
    then.getDate() === yesterday.getDate();
  if (wasYesterday) return "Yesterday";
  return then.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default async function CustomersPage() {
  const db = createServerClient();

  const [usersRes, ordersRes, loyaltyRes] = await Promise.all([
    db
      .from("app_user")
      .select("id, display_name, phone, email, role, is_blocked, created_at")
      .order("created_at", { ascending: false }),
    db.from("order").select("user_id, total_minor, status, created_at"),
    db.from("loyalty_account").select("user_id, points_balance"),
  ]);

  const error = usersRes.error;

  // Aggregate orders per user.
  const stats = new Map<string, { orders: number; spent: number; last: string | null }>();
  for (const o of (ordersRes.data ?? []) as {
    user_id: string;
    total_minor: number | null;
    status: string | null;
    created_at: string | null;
  }[]) {
    if (!o.user_id) continue;
    const cur = stats.get(o.user_id) ?? { orders: 0, spent: 0, last: null };
    cur.orders += 1;
    if (o.status !== "cancelled") cur.spent += Number(o.total_minor ?? 0);
    if (o.created_at && (!cur.last || o.created_at > cur.last)) cur.last = o.created_at;
    stats.set(o.user_id, cur);
  }

  const points = new Map<string, number>();
  for (const l of (loyaltyRes.data ?? []) as { user_id: string; points_balance: number | null }[]) {
    if (l.user_id) points.set(l.user_id, Number(l.points_balance ?? 0));
  }

  const customers: Customer[] = ((usersRes.data ?? []) as {
    id: string;
    display_name: string | null;
    phone: string | null;
    email: string | null;
    role: string | null;
    is_blocked: boolean | null;
    created_at: string | null;
  }[]).map((u) => {
    const s = stats.get(u.id);
    return {
      id: u.id,
      name: u.display_name?.trim() || "Unnamed customer",
      contact: u.phone || u.email || "—",
      orders: s?.orders ?? 0,
      spent: s?.spent ?? 0,
      blocked: u.is_blocked ?? false,
      points: points.get(u.id) ?? 0,
      last: lastOrderLabel(s?.last ?? null),
    };
  });

  return (
    <>
      <PageHeader
        title="Customers"
        description={
          error
            ? "Couldn't load customers — check the Supabase keys in web/.env.local."
            : `${formatInt(customers.length)} ${customers.length === 1 ? "customer" : "customers"}`
        }
      />
      {customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center lg:px-10">
          <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <UsersThree weight="duotone" className="size-6" />
          </span>
          <p className="mt-4 text-sm font-medium">No customers yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {error
              ? "We couldn't reach the database."
              : "Customers will appear here once people sign up and start ordering."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-6 py-2.5 font-medium lg:px-10">Customer</th>
                <th className="px-3 py-2.5 font-medium">Loyalty</th>
                <th className="px-3 py-2.5 text-right font-medium">Orders</th>
                <th className="px-3 py-2.5 text-right font-medium">Total spent</th>
                <th className="px-3 py-2.5 text-right font-medium">Last order</th>
                <th className="px-6 py-2.5 text-right font-medium lg:px-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border border-t border-border">
              {customers.map((c) => {
                const tier = loyaltyTier(c.points, c.blocked);
                return (
                  <tr key={c.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-6 py-3.5 lg:px-10">
                      <Link href={`/customers/${c.id}`} className="group flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {initials(c.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium group-hover:text-primary group-hover:underline">{c.name}</div>
                          <div className="nums truncate text-xs text-muted-foreground">{c.contact}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusPill tone={tier.tone}>{tier.label}</StatusPill>
                    </td>
                    <td className="nums px-3 py-3.5 text-right">{formatInt(c.orders)}</td>
                    <td className="nums px-3 py-3.5 text-right font-semibold">{formatLe(c.spent, 2)}</td>
                    <td className="px-3 py-3.5 text-right text-muted-foreground">{c.last}</td>
                    <td className="px-6 py-3.5 text-right lg:px-10">
                      <CustomerActions id={c.id} blocked={c.blocked} name={c.name} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

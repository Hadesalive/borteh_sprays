import { createServerClient } from "@/lib/supabase/server";
import { type Tone } from "@/components/admin/chip";
import { CustomersTable, type CustomerRow } from "@/components/admin/customers-table";
import { PageHeader } from "@/components/admin/page-header";
import { ExportButton } from "@/components/admin/export-button";
import { EmptyState } from "@/components/admin/empty-state";
import { formatInt, formatLe } from "@/lib/format";
import { listCustomers, getBlockedCustomerCount, PAGE_SIZE } from "@/lib/queries/customers";
import { type DataTableSummaryStat } from "@/components/admin/data-table";

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

function loyaltyTier(points: number, blocked: boolean): { label: string; tone: Tone } {
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

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const db = createServerClient();
  const page = Math.max(0, Number((await searchParams).page ?? "0") || 0);

  const [{ rows: users, total }, blockedTotal] = await Promise.all([
    listCustomers(db, { page, pageSize: PAGE_SIZE }),
    getBlockedCustomerCount(db),
  ]);

  // Order/loyalty stats are scoped to just this page's users — bounded, not a
  // full-table scan the way the pre-migration version worked.
  const userIds = users.map((u) => u.id);
  const [ordersRes, loyaltyRes] = await Promise.all([
    userIds.length
      ? db.from("order").select("user_id, total_minor, status, created_at").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; total_minor: number | null; status: string | null; created_at: string | null }[] }),
    userIds.length
      ? db.from("loyalty_account").select("user_id, points_balance").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; points_balance: number | null }[] }),
  ]);

  const stats = new Map<string, { orders: number; spent: number; last: string | null }>();
  for (const o of (ordersRes.data ?? []) as { user_id: string; total_minor: number | null; status: string | null; created_at: string | null }[]) {
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

  const customers: Customer[] = users.map((u) => {
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

  const rows: CustomerRow[] = customers.map((c) => {
    const tier = loyaltyTier(c.points, c.blocked);
    return {
      id: c.id,
      name: c.name,
      contact: c.contact,
      tierLabel: tier.label,
      tierTone: tier.tone,
      orders: c.orders,
      spent: c.spent,
      last: c.last,
    };
  });

  const summary: DataTableSummaryStat[] = [
    { n: formatInt(total), label: "customers", tone: "text-foreground" },
    { n: formatInt(blockedTotal), label: "blocked", tone: blockedTotal ? "text-destructive" : "text-foreground" },
  ];

  return (
    <>
      <PageHeader title="Customers" description={`${formatInt(total)} ${total === 1 ? "customer" : "customers"}.`}>
        <ExportButton
          label="Export this page"
          filename="borteh-customers.csv"
          headers={["Name", "Contact", "Tier", "Orders", "Total spent (Le)", "Last order"]}
          rows={rows.map((c) => [c.name, c.contact, c.tierLabel, c.orders, formatLe(c.spent, 2), c.last])}
        />
      </PageHeader>

      <div className="px-5 pb-6 pt-2">
        {total === 0 ? (
          <EmptyState title="No customers yet" description="Customers will appear here once people sign up and start ordering." />
        ) : (
          <CustomersTable customers={rows} summary={summary} page={page} total={total} pageSize={PAGE_SIZE} />
        )}
      </div>
    </>
  );
}

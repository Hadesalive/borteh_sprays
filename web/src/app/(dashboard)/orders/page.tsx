import Link from "next/link";
import { DownloadSimple, Plus } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { type PillTone } from "@/components/admin/status-pill";
import { OrdersTable, type OrderRow } from "@/components/admin/orders-table";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, PillTone> = {
  pending: "warning",
  cod_pending: "warning",
  confirmed: "info",
  preparing: "info",
  packing: "info",
  ready: "info",
  dispatched: "info",
  out_for_delivery: "info",
  delivered: "success",
  completed: "success",
  cancelled: "danger",
  returned: "danger",
};

function humanize(s: string): string {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function statusTone(s: string): PillTone {
  return STATUS_TONE[s] ?? "neutral";
}

function paymentInfo(method: string): { label: string; tone: PillTone } {
  switch (method) {
    case "cash_on_delivery":
      return { label: "COD", tone: "warning" };
    case "cash":
      return { label: "Cash", tone: "neutral" };
    case "monime":
      return { label: "Monime", tone: "info" };
    case "card":
      return { label: "Card", tone: "info" };
    default:
      return { label: humanize(method), tone: "neutral" };
  }
}

function fmtPlaced(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function OrdersPage() {
  const db = createServerClient();

  const { data, error } = await db
    .from("order")
    .select(
      "id, order_number, status, fulfillment_type, payment_method, total_minor, created_at, placed_at, user_id"
    )
    .order("created_at", { ascending: false });

  const records = (data ?? []) as Record<string, unknown>[];

  // Fetch customers separately and attach (avoid relying on an embed).
  const userIds = [...new Set(records.map((r) => r.user_id as string).filter(Boolean))];
  const customers = new Map<string, { name: string; phone: string }>();
  if (userIds.length > 0) {
    const { data: users } = await db
      .from("app_user")
      .select("id, display_name, phone")
      .in("id", userIds);
    for (const u of (users ?? []) as Record<string, unknown>[]) {
      customers.set(u.id as string, {
        name: (u.display_name as string) ?? "",
        phone: (u.phone as string) ?? "",
      });
    }
  }

  const orders: OrderRow[] = records.map((r) => {
    const status = (r.status as string) ?? "pending";
    const channel = humanize((r.fulfillment_type as string) ?? "");
    const cust = customers.get(r.user_id as string);
    return {
      id: r.id as string,
      number: (r.order_number as string) ?? "",
      placed: fmtPlaced((r.placed_at as string) ?? (r.created_at as string)),
      customer: cust?.name || "Unknown customer",
      phone: cust?.phone || "—",
      channel,
      payment: paymentInfo((r.payment_method as string) ?? ""),
      status,
      statusLabel: humanize(status),
      statusTone: statusTone(status),
      minor: (r.total_minor as number) ?? 0,
    };
  });

  return (
    <>
      <PageHeader
        title="Orders"
        description={
          error
            ? "Couldn't load orders — check the Supabase keys in web/.env.local."
            : "Every online and counter order, newest first."
        }
      >
        <Link
          href="/orders/export"
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <DownloadSimple weight="duotone" className="size-4" />
          Export
        </Link>
        <Link
          href="/orders/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Plus weight="duotone" className="size-4" />
          New order
        </Link>
      </PageHeader>

      <OrdersTable orders={orders} />
    </>
  );
}

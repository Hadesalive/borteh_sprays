import Link from "next/link";
import { MapPin, Truck } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";
import { formatLe } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { StatusPill, type PillTone } from "@/components/admin/status-pill";

export const dynamic = "force-dynamic";

type Job = {
  id: string;
  orderNumber: string;
  customer: string;
  zone: string;
  landmark: string;
  items: number;
  payment: { label: string; tone: PillTone };
  cod: number | null;
  rider: string | null;
};

function isToday(ts: string | null): boolean {
  if (!ts) return false;
  const d = new Date(ts);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export default async function DispatchPage() {
  const db = createServerClient();

  const [ordersRes, jobsRes] = await Promise.all([
    db
      .from("order")
      .select("id, order_number, status, payment_method, total_minor, user_id, delivery_zone_id, landmark_snapshot, recipient_name_snapshot, delivered_at")
      .eq("fulfillment_type", "delivery")
      .not("status", "in", "(cancelled,returned)")
      .order("created_at", { ascending: true }),
    db.from("delivery_job").select("order_id, rider_id, status, delivered_at"),
  ]);

  const orders = (ordersRes.data ?? []) as Array<Record<string, unknown>>;
  const jobs = (jobsRes.data ?? []) as Array<{ order_id: string; rider_id: string | null; status: string; delivered_at: string | null }>;
  const jobByOrder = new Map(jobs.map((j) => [j.order_id, j]));

  // Customers, zones, item counts — separate lookups (no fragile embeds).
  const userIds = [...new Set(orders.map((o) => o.user_id).filter(Boolean))] as string[];
  const zoneIds = [...new Set(orders.map((o) => o.delivery_zone_id).filter(Boolean))] as string[];
  const orderIds = orders.map((o) => o.id) as string[];

  const [usersRes, zonesRes, itemsRes] = await Promise.all([
    userIds.length ? db.from("app_user").select("id, display_name").in("id", userIds) : Promise.resolve({ data: [] }),
    zoneIds.length ? db.from("delivery_zone").select("id, name").in("id", zoneIds) : Promise.resolve({ data: [] }),
    orderIds.length ? db.from("order_item").select("order_id").in("order_id", orderIds) : Promise.resolve({ data: [] }),
  ]);

  const nameById = new Map((usersRes.data ?? []).map((u: Record<string, unknown>) => [u.id, u.display_name as string]));
  const zoneById = new Map((zonesRes.data ?? []).map((z: Record<string, unknown>) => [z.id, z.name as string]));
  const itemCount = new Map<string, number>();
  for (const it of (itemsRes.data ?? []) as Array<{ order_id: string }>) {
    itemCount.set(it.order_id, (itemCount.get(it.order_id) ?? 0) + 1);
  }

  const ready: Job[] = [];
  const transit: Job[] = [];
  const done: Job[] = [];

  for (const o of orders) {
    const job = jobByOrder.get(o.id as string);
    const isCod = String(o.payment_method ?? "").includes("cash");
    const card: Job = {
      id: o.id as string,
      orderNumber: o.order_number as string,
      customer: (nameById.get(o.user_id) as string) ?? (o.recipient_name_snapshot as string) ?? "Customer",
      zone: (zoneById.get(o.delivery_zone_id) as string) ?? "—",
      landmark: (o.landmark_snapshot as string) ?? "",
      items: itemCount.get(o.id as string) ?? 0,
      payment: isCod ? { label: "COD", tone: "warning" } : { label: "Prepaid", tone: "info" },
      cod: isCod ? (o.total_minor as number) : null,
      rider: null,
    };
    const status = o.status as string;
    if (status === "delivered" || job?.status === "delivered") {
      if (isToday((o.delivered_at as string) ?? job?.delivered_at ?? null)) done.push(card);
    } else if (status === "out_for_delivery" || ["assigned", "picked_up", "out_for_delivery"].includes(job?.status ?? "")) {
      transit.push(card);
    } else {
      ready.push(card);
    }
  }

  const COLUMNS = [
    { key: "ready", label: "Ready to dispatch", accent: "bg-warning", jobs: ready },
    { key: "transit", label: "Out for delivery", accent: "bg-info", jobs: transit },
    { key: "done", label: "Delivered today", accent: "bg-success", jobs: done },
  ];

  return (
    <>
      <PageHeader title="Dispatch" description="Assign riders and track deliveries across the day.">
        <Link
          href="/dispatch/riders"
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Truck weight="duotone" className="size-4" />
          Riders
        </Link>
      </PageHeader>

      <div className="grid gap-5 px-6 py-6 lg:grid-cols-3 lg:px-10">
        {COLUMNS.map((col) => (
          <section key={col.key} className="flex flex-col">
            <div className="mb-3 flex items-center gap-2">
              <span className={cn("size-2 rounded-full", col.accent)} />
              <h2 className="text-sm font-semibold">{col.label}</h2>
              <span className="nums ml-auto text-xs text-muted-foreground">{col.jobs.length}</span>
            </div>

            <div className="flex flex-col gap-3">
              {col.jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/orders/${job.id}`}
                  className="block rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-foreground/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="nums text-sm font-semibold">#{job.orderNumber}</span>
                    <StatusPill tone={job.payment.tone}>{job.payment.label}</StatusPill>
                  </div>
                  <p className="mt-1.5 text-sm font-medium">{job.customer}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    {[job.zone, job.landmark].filter((x) => x && x !== "—").join(" · ") || "No address"}
                  </p>

                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    {job.cod ? (
                      <span className="nums text-xs">
                        <span className="text-muted-foreground">Collect </span>
                        <span className="font-semibold">{formatLe(job.cod, 2)}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {job.items} {job.items === 1 ? "item" : "items"}
                      </span>
                    )}
                    {job.rider ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span className="grid size-5 place-items-center rounded-full bg-muted text-[0.6rem] font-semibold text-muted-foreground">
                          {job.rider[0]}
                        </span>
                        {job.rider}
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))}
              {col.jobs.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  Nothing here.
                </p>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

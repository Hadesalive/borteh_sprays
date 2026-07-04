import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  Circle,
  MapPin,
  Phone,
  Sparkle,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";
import { formatLe } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";
import { StatusPill } from "@/components/admin/status-pill";
import { OrderStatusActions } from "@/components/admin/order-status-actions";
import type { OrderStatus } from "@/app/(dashboard)/orders/actions";

export const dynamic = "force-dynamic";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

function statusTone(status: string): Tone {
  if (status === "delivered") return "success";
  if (status === "cancelled" || status === "returned") return "danger";
  if (status === "pending") return "warning";
  return "info"; // confirmed / preparing / ready / out_for_delivery
}

const humanize = (s: string | null) =>
  (s ?? "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function fmt(ts: string | null): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h2>
  );
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createServerClient();

  const { data: order } = await db
    .from("order")
    .select(
      "id, order_number, status, fulfillment_type, payment_method, user_id, delivery_zone_id, subtotal_minor, delivery_fee_minor, discount_minor, total_minor, notes, contact_phone_snapshot, recipient_name_snapshot, landmark_snapshot, geo_lat_snapshot, geo_lng_snapshot, placed_at, confirmed_at, delivered_at, cancelled_at, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();

  const [itemsRes, customerRes, zoneRes, countRes] = await Promise.all([
    db.from("order_item").select("product_name_snapshot, variant_label_snapshot, sku_snapshot, unit_price_minor, qty, line_total_minor").eq("order_id", id),
    db.from("app_user").select("display_name, phone").eq("id", order.user_id).maybeSingle(),
    order.delivery_zone_id
      ? db.from("delivery_zone").select("name").eq("id", order.delivery_zone_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("order").select("id", { count: "exact", head: true }).eq("user_id", order.user_id),
  ]);

  const items = (itemsRes.data ?? []) as Array<{
    product_name_snapshot: string;
    variant_label_snapshot: string | null;
    sku_snapshot: string | null;
    unit_price_minor: number;
    qty: number;
    line_total_minor: number;
  }>;
  const customer = customerRes.data as { display_name: string | null; phone: string | null } | null;
  const zone = (zoneRes.data as { name: string } | null) ?? null;
  const customerOrders = countRes.count ?? 1;

  const name = customer?.display_name ?? order.recipient_name_snapshot ?? "Customer";
  const phone = order.contact_phone_snapshot ?? customer?.phone ?? null;
  const waDigits = phone?.replace(/\D/g, "") ?? "";
  const isDelivery = order.fulfillment_type === "delivery";

  const steps = [
    { label: "Placed", at: order.placed_at ?? order.created_at },
    { label: "Confirmed", at: order.confirmed_at },
    { label: isDelivery ? "Delivered" : "Picked up", at: order.delivered_at },
  ];
  if (order.cancelled_at) steps.push({ label: "Cancelled", at: order.cancelled_at });
  const firstPending = steps.findIndex((s) => !s.at);

  return (
    <>
      {/* Header */}
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Link href="/orders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Orders
        </Link>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="nums text-xl font-semibold tracking-tight">#{order.order_number}</h1>
            <StatusPill tone={statusTone(order.status)} dot>
              {humanize(order.status)}
            </StatusPill>
            <span className="text-sm text-muted-foreground">{fmt(order.placed_at ?? order.created_at)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {phone ? (
              <>
                <a href={`tel:${phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-muted">
                  <Phone weight="duotone" className="size-4" />
                  Call
                </a>
                <a href={`https://wa.me/${waDigits}`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-muted">
                  <WhatsappLogo weight="duotone" className="size-4" />
                  WhatsApp
                </a>
              </>
            ) : null}
            <OrderStatusActions id={order.id as string} status={order.status as OrderStatus} />
          </div>
        </div>
      </div>

      <div className="grid gap-10 px-6 py-8 lg:grid-cols-[1.6fr_1fr] lg:px-10">
        {/* Main */}
        <div className="space-y-8">
          <section>
            <SectionLabel>Items</SectionLabel>
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {items.map((it, idx) => (
                <li key={idx} className="flex items-center gap-3 py-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground ring-1 ring-border">
                    <Sparkle weight="duotone" className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.product_name_snapshot}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[it.variant_label_snapshot, it.sku_snapshot].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="nums w-28 text-right text-sm text-muted-foreground">
                    {it.qty} × {formatLe(it.unit_price_minor, 2)}
                  </span>
                  <span className="nums w-24 text-right text-sm font-semibold">
                    {formatLe(it.line_total_minor, 2)}
                  </span>
                </li>
              ))}
              {items.length === 0 ? <li className="py-6 text-sm text-muted-foreground">No items.</li> : null}
            </ul>
            <dl className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>Subtotal</dt>
                <dd className="nums">{formatLe(order.subtotal_minor, 2)}</dd>
              </div>
              {isDelivery ? (
                <div className="flex items-center justify-between text-muted-foreground">
                  <dt>Delivery fee</dt>
                  <dd className="nums">{formatLe(order.delivery_fee_minor ?? 0, 2)}</dd>
                </div>
              ) : null}
              {order.discount_minor ? (
                <div className="flex items-center justify-between text-muted-foreground">
                  <dt>Discount</dt>
                  <dd className="nums">−{formatLe(order.discount_minor, 2)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
                <dt>Total</dt>
                <dd className="nums">{formatLe(order.total_minor, 2)}</dd>
              </div>
            </dl>
          </section>

          <section>
            <SectionLabel>{isDelivery ? "Delivery" : "Pickup"}</SectionLabel>
            <div className="mt-4 space-y-2 text-sm">
              {isDelivery ? (
                <p className="flex items-start gap-2">
                  <MapPin weight="duotone" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>
                    {zone ? <span className="font-medium">{zone.name}</span> : null}
                    {order.landmark_snapshot ? <span className="block text-muted-foreground">{order.landmark_snapshot}</span> : null}
                    {order.geo_lat_snapshot != null && order.geo_lng_snapshot != null ? (
                      <span className="nums block text-xs text-muted-foreground">
                        GPS {Number(order.geo_lat_snapshot).toFixed(4)}, {Number(order.geo_lng_snapshot).toFixed(4)}
                      </span>
                    ) : null}
                  </span>
                </p>
              ) : (
                <p className="text-muted-foreground">Collection in store.</p>
              )}
              {order.notes ? <p className="text-muted-foreground">Note: {order.notes}</p> : null}
            </div>
          </section>
        </div>

        {/* Side */}
        <div className="space-y-8 lg:border-l lg:border-border lg:pl-10">
          <section>
            <SectionLabel>Status</SectionLabel>
            <ol className="mt-4 space-y-0.5">
              {steps.map((step, i) => {
                const state = step.at ? "done" : i === firstPending ? "current" : "pending";
                return (
                  <li key={step.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      {state === "done" ? (
                        <CheckCircle weight="fill" className="size-5 text-success-soft-foreground" />
                      ) : state === "current" ? (
                        <Circle weight="fill" className="size-5 text-primary" />
                      ) : (
                        <Circle className="size-5 text-border" />
                      )}
                      {i < steps.length - 1 ? (
                        <span className={cn("my-0.5 w-px flex-1", state === "done" ? "bg-success-soft-foreground/40" : "bg-border")} />
                      ) : null}
                    </div>
                    <div className="pb-4">
                      <p className={cn("text-sm", state === "pending" ? "text-muted-foreground" : "font-medium")}>{step.label}</p>
                      {step.at ? <p className="nums text-xs text-muted-foreground">{fmt(step.at)}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section>
            <SectionLabel>Payment</SectionLabel>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span>{humanize(order.payment_method)}</span>
              <StatusPill tone={order.status === "delivered" ? "success" : "warning"}>
                {order.status === "delivered" ? "Paid" : "Pending"}
              </StatusPill>
            </div>
          </section>

          <section>
            <SectionLabel>Customer</SectionLabel>
            <div className="mt-4 flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="nums truncate text-xs text-muted-foreground">
                  {[phone, `${customerOrders} order${customerOrders === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

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
import { getMonimeChannels } from "@/lib/queries/orders";
import { paymentLabel } from "@/lib/payment-channel";
import { Chip, humanize, statusTone } from "@/components/admin/chip";
import { Card } from "@/components/ui/card";
import { OrderStatusActions } from "@/components/admin/order-status-actions";
import type { OrderStatus } from "@/app/(dashboard)/orders/actions";

export const dynamic = "force-dynamic";

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

  const { data: order, error } = await db
    .from("order")
    .select(
      "id, order_number, status, fulfillment_type, payment_method, user_id, delivery_zone_id, subtotal_minor, delivery_fee_minor, discount_minor, total_minor, notes, contact_phone_snapshot, recipient_name_snapshot, landmark_snapshot, geo_lat_snapshot, geo_lng_snapshot, placed_at, confirmed_at, delivered_at, cancelled_at, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!order) notFound();

  const [itemsRes, customerRes, zoneRes, countRes] = await Promise.all([
    db.from("order_item").select("product_name_snapshot, variant_label_snapshot, sku_snapshot, unit_price_minor, qty, line_total_minor").eq("order_id", id),
    db.from("app_user").select("display_name, phone").eq("id", order.user_id).maybeSingle(),
    order.delivery_zone_id
      ? db.from("delivery_zone").select("name").eq("id", order.delivery_zone_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("order").select("id", { count: "exact", head: true }).eq("user_id", order.user_id),
  ]);

  if (itemsRes.error) throw itemsRes.error;

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

  const channel = order.payment_method === "monime"
    ? (await getMonimeChannels(db, [order.id as string])).get(order.id as string)
    : null;
  // Cash is only actually collected on delivery; a confirmed Monime order is
  // paid the moment it's confirmed — that transition only ever happens via
  // the verified webhook, so "confirmed or later, not cancelled" means paid.
  const paid = order.payment_method === "monime"
    ? order.status !== "pending_payment" && order.status !== "cancelled"
    : order.status === "delivered";

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
    <div className="px-5 pb-6 pt-2">
      <Link href="/orders" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Orders
      </Link>

      {/* Header: key facts + the one primary action */}
      <header className="flex items-start justify-between py-2 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="nums text-xl font-[650] tracking-[-0.2px]">#{order.order_number}</h1>
            <Chip tone={statusTone(order.status)}>{humanize(order.status)}</Chip>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {name} · {fmt(order.placed_at ?? order.created_at)} ·{" "}
            <span className="nums">{formatLe(order.total_minor, 2)}</span>
          </p>
        </div>
        <OrderStatusActions id={order.id as string} status={order.status as OrderStatus} />
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Main */}
        <div className="space-y-4">
          <Card className="p-4">
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
          </Card>

          <Card className="p-4">
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
          </Card>
        </div>

        {/* Side */}
        <div className="space-y-4">
          <Card className="p-4">
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
          </Card>

          <Card className="p-4">
            <SectionLabel>Payment</SectionLabel>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span>{paymentLabel(order.payment_method, channel)}</span>
              <Chip tone={paid ? "success" : "warning"}>{paid ? "Paid" : "Pending"}</Chip>
            </div>
            {channel?.phoneNumber ? (
              <p className="nums mt-1 text-xs text-muted-foreground">{channel.phoneNumber}</p>
            ) : null}
          </Card>

          <Card className="p-4">
            <SectionLabel>Customer</SectionLabel>
            <div className="mt-4 flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="nums truncate text-xs text-muted-foreground">
                  {[phone, `${customerOrders} order${customerOrders === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                </p>
              </div>
              {phone ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <a
                    href={`tel:${phone}`}
                    aria-label="Call customer"
                    className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Phone weight="duotone" className="size-4" />
                  </a>
                  <a
                    href={`https://wa.me/${waDigits}`}
                    aria-label="Message customer on WhatsApp"
                    className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <WhatsappLogo weight="duotone" className="size-4" />
                  </a>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

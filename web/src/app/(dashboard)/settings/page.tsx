import Link from "next/link";
import type { Icon } from "@phosphor-icons/react";
import { ArrowRight, BellRinging, Gift, MapPinArea, Storefront, UsersThree } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { formatInt } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

type Row = { title: string; description: string; href: string | null; icon: Icon };

export default async function SettingsPage() {
  const db = createServerClient();
  const [storeRes, zonesRes, loyaltyRes, staffRes] = await Promise.all([
    db.from("store_location").select("name").eq("is_default", true).maybeSingle(),
    db.from("delivery_zone").select("id", { count: "exact", head: true }),
    db.from("loyalty_config").select("loyalty_enabled").maybeSingle(),
    db.from("app_user").select("id", { count: "exact", head: true }).in("role", ["owner", "staff"]),
  ]);

  const storeName = (storeRes.data?.name as string) ?? "Not set";
  const zoneCount = zonesRes.count ?? 0;
  const loyaltyOn = loyaltyRes.data?.loyalty_enabled === true;
  const staffCount = staffRes.count ?? 0;

  const rows: Row[] = [
    { title: "Delivery zones & fees", description: `${formatInt(zoneCount)} ${zoneCount === 1 ? "zone" : "zones"} · tap to edit fees`, href: "/settings/zones", icon: MapPinArea },
    { title: "Loyalty & promotions", description: loyaltyOn ? "Points enabled" : "Points off", href: "/settings/loyalty", icon: Gift },
    { title: "Store profile", description: storeName, href: "/settings/store", icon: Storefront },
    { title: "Staff & roles", description: `${formatInt(staffCount)} staff ${staffCount === 1 ? "account" : "accounts"}`, href: "/settings/staff", icon: UsersThree },
    { title: "Notifications", description: "In-app alerts for orders, low stock, restock demand", href: "/settings/notifications", icon: BellRinging },
  ];

  return (
    <>
      <PageHeader title="Settings" description="Configure how Borteh runs — no code required." />
      <div className="mx-auto max-w-3xl px-6 py-6 lg:px-10">
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {rows.map((s) => {
            const inner = (
              <>
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                  <s.icon weight="duotone" className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{s.title}</span>
                  <span className="block text-sm text-muted-foreground">{s.description}</span>
                </span>
                {s.href ? (
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                ) : (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Soon</span>
                )}
              </>
            );
            return (
              <li key={s.title}>
                {s.href ? (
                  <Link href={s.href} className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none">
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-center gap-4 px-4 py-4">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

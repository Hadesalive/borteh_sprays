import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { ZoneControls } from "@/components/admin/zone-controls";

export const dynamic = "force-dynamic";

export default async function ZonesPage() {
  const db = createServerClient();
  const { data } = await db
    .from("delivery_zone")
    .select("id, name, region_text, eta_text, estimated_fee_minor, is_active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const zones = (data ?? []) as Array<{
    id: string;
    name: string;
    region_text: string | null;
    eta_text: string | null;
    estimated_fee_minor: number | null;
    is_active: boolean;
  }>;

  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Settings
        </Link>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Delivery zones &amp; fees</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tap a fee to edit it. Toggle a zone off to hide it from checkout.</p>
      </div>

      <ul className="mx-auto max-w-3xl divide-y divide-border px-6 py-2 lg:px-10">
        {zones.map((z) => (
          <li key={z.id} className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="font-medium">{z.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {[z.region_text, z.eta_text].filter(Boolean).join(" · ") || "No area set"}
              </p>
            </div>
            <ZoneControls id={z.id} feeMinor={z.estimated_fee_minor ?? 0} active={z.is_active} />
          </li>
        ))}
        {zones.length === 0 ? <li className="py-10 text-center text-sm text-muted-foreground">No delivery zones yet.</li> : null}
      </ul>
    </>
  );
}

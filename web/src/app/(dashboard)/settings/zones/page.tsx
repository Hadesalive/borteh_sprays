import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/admin/empty-state";
import { ZoneControls } from "@/components/admin/zone-controls";

export const dynamic = "force-dynamic";

export default async function ZonesPage() {
  const db = createServerClient();
  const { data, error } = await db
    .from("delivery_zone")
    .select("id, name, region_text, eta_text, estimated_fee_minor, is_active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;

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
      <PageHeader title="Delivery zones & fees" description="Tap a fee to edit it. Toggle a zone off to hide it from checkout." />

      <div className="px-5 pb-6 pt-2">
        <Link
          href="/settings"
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Settings
        </Link>

        <Card className="mt-4 overflow-hidden p-0">
          {zones.length === 0 ? (
            <EmptyState title="No delivery zones yet." />
          ) : (
            <ul className="divide-y divide-border">
              {zones.map((z) => (
                <li key={z.id} className="flex items-center justify-between gap-4 px-4 py-4">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{z.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[z.region_text, z.eta_text].filter(Boolean).join(" · ") || "No area set"}
                    </p>
                  </div>
                  <ZoneControls id={z.id} feeMinor={z.estimated_fee_minor ?? 0} active={z.is_active} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

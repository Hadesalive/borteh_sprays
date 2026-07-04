import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { formatLe } from "@/lib/format";
import { LoyaltyControls } from "@/components/admin/loyalty-controls";
import { LoyaltyRates } from "@/components/admin/loyalty-rates";
import { StatusPill } from "@/components/admin/status-pill";

export const dynamic = "force-dynamic";

export default async function LoyaltyPage() {
  const db = createServerClient();

  const { data: configData } = await db.from("loyalty_config").select("*").limit(1).maybeSingle();
  const { data: tiersData } = await db.from("loyalty_tier").select("*").order("rank", { ascending: true });

  const config = configData as {
    id: number;
    loyalty_enabled: boolean;
    promos_enabled: boolean;
    tiers_enabled: boolean;
    points_per_currency_unit: number;
    point_value_minor: number;
    points_expiry_days: number;
  } | null;

  const tiers = (tiersData ?? []) as Array<{
    id: string;
    name: string;
    cumulative_spend_threshold_minor: number;
    discount_percent: number;
    rank: number;
    is_active: boolean;
  }>;

  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Settings
        </Link>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Loyalty &amp; promotions</h1>
        <p className="mt-1 text-sm text-muted-foreground">Turn programmes on or off and review how points and tiers work.</p>
      </div>

      <div className="mx-auto max-w-3xl space-y-10 px-6 py-8 lg:px-10">
        <section>
          <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">Programme</h2>
          {config ? (
            <div className="mt-2">
              <LoyaltyControls
                id={config.id}
                loyaltyEnabled={config.loyalty_enabled}
                promosEnabled={config.promos_enabled}
                tiersEnabled={config.tiers_enabled}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No loyalty configuration found.</p>
          )}
        </section>

        {config ? (
          <section>
            <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">Earning</h2>
            <LoyaltyRates
              id={config.id}
              pointsPerUnit={config.points_per_currency_unit}
              pointValueMinor={config.point_value_minor}
              expiryDays={config.points_expiry_days}
            />
          </section>
        ) : null}

        <section>
          <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">Tiers</h2>
          <ul className="mt-2 divide-y divide-border">
            {tiers.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{t.name}</p>
                  <p className="nums truncate text-sm text-muted-foreground">
                    {formatLe(t.cumulative_spend_threshold_minor)} · {t.discount_percent}% off
                  </p>
                </div>
                <StatusPill tone={t.is_active ? "success" : "neutral"} dot>
                  {t.is_active ? "Active" : "Inactive"}
                </StatusPill>
              </li>
            ))}
            {tiers.length === 0 ? <li className="py-10 text-center text-sm text-muted-foreground">No tiers yet.</li> : null}
          </ul>
        </section>
      </div>
    </>
  );
}

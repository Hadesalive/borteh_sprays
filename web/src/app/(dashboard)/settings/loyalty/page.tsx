import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LoyaltyControls } from "@/components/admin/loyalty-controls";
import { LoyaltyRates } from "@/components/admin/loyalty-rates";
import { LoyaltyTiers, type TierRow } from "@/components/admin/loyalty-tiers";

export const dynamic = "force-dynamic";

type LoyaltyConfig = {
  id: number;
  loyalty_enabled: boolean;
  promos_enabled: boolean;
  tiers_enabled: boolean;
  points_per_currency_unit: number;
  point_value_minor: number;
  points_expiry_days: number;
  referral_points: number | null;
};

export default async function LoyaltyPage() {
  const db = createServerClient();

  const [configRes, tiersRes] = await Promise.all([
    db.from("loyalty_config").select("*").limit(1).maybeSingle(),
    db.from("loyalty_tier").select("*").order("rank", { ascending: true }),
  ]);
  if (configRes.error) throw configRes.error;
  if (tiersRes.error) throw tiersRes.error;

  const config = configRes.data as LoyaltyConfig | null;

  const tiers: TierRow[] = ((tiersRes.data ?? []) as Array<{
    id: string;
    name: string;
    cumulative_spend_threshold_minor: number;
    discount_percent: number;
    is_active: boolean;
  }>).map((t) => ({
    id: t.id,
    name: t.name,
    thresholdMinor: t.cumulative_spend_threshold_minor,
    discountPercent: Number(t.discount_percent),
    isActive: t.is_active,
  }));

  return (
    <>
      <PageHeader title="Loyalty" description="Points customers earn, and the tier discounts that come with spending more." />

      <div className="px-5 pb-6 pt-2">
        <Link
          href="/settings"
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Settings
        </Link>

        {config ? (
          <div className="mt-4 space-y-4">
            <LoyaltyRates
              id={config.id}
              pointsPerUnit={config.points_per_currency_unit}
              pointValueMinor={config.point_value_minor}
              expiryDays={config.points_expiry_days}
              referralPoints={config.referral_points ?? 0}
              loyaltyEnabled={config.loyalty_enabled}
            />

            <Card className="overflow-hidden p-0">
              <CardHeader className="border-b pt-4">
                <CardTitle role="heading" aria-level={2}>Programme</CardTitle>
                <CardDescription>
                  Each switch works on its own — turning points off does not turn off tier discounts, and vice versa.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <LoyaltyControls
                  id={config.id}
                  loyaltyEnabled={config.loyalty_enabled}
                  promosEnabled={config.promos_enabled}
                  tiersEnabled={config.tiers_enabled}
                />
              </CardContent>
            </Card>

            <LoyaltyTiers tiers={tiers} tiersEnabled={config.tiers_enabled} />
          </div>
        ) : (
          <Card className="mt-4 p-4">
            <p className="text-[13px] text-muted-foreground">
              No loyalty configuration row exists yet, so there is nothing to edit. One row in{" "}
              <span className="nums">loyalty_config</span> is expected.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}

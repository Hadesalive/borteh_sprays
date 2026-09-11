"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setLoyaltyFlag } from "@/app/(dashboard)/settings/loyalty/actions";
import { Toggle } from "@/components/admin/toggle";

type Field = "loyalty_enabled" | "promos_enabled" | "tiers_enabled";

export function LoyaltyControls({
  id,
  loyaltyEnabled,
  promosEnabled,
  tiersEnabled,
}: {
  id: number;
  loyaltyEnabled: boolean;
  promosEnabled: boolean;
  tiersEnabled: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();

  function setFlag(field: Field, value: boolean) {
    start(async () => {
      await setLoyaltyFlag(id, field, value);
      router.refresh();
    });
  }

  const rows: Array<{ field: Field; label: string; description: string; on: boolean }> = [
    {
      field: "loyalty_enabled",
      label: "Loyalty points",
      description: "Customers earn points on delivered orders and can spend them at checkout.",
      on: loyaltyEnabled,
    },
    {
      field: "promos_enabled",
      label: "Promo codes",
      description: "Lets customers enter a discount code at checkout.",
      on: promosEnabled,
    },
    {
      field: "tiers_enabled",
      label: "Tier discounts",
      description: "Applies a tier's discount automatically once a customer's lifetime spend qualifies.",
      on: tiersEnabled,
    },
  ];

  return (
    <ul className="divide-y divide-accent">
      {rows.map((r) => (
        <li key={r.field} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium">{r.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
          </div>
          <Toggle defaultOn={r.on} label={r.label} onChange={(on) => setFlag(r.field, on)} />
        </li>
      ))}
    </ul>
  );
}

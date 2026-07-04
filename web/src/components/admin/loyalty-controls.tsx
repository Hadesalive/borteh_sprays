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
      description: "Customers earn points on every order.",
      on: loyaltyEnabled,
    },
    {
      field: "promos_enabled",
      label: "Promotions",
      description: "Show promo codes and offers at checkout.",
      on: promosEnabled,
    },
    {
      field: "tiers_enabled",
      label: "Tiers",
      description: "Reward repeat spend with tier discounts.",
      on: tiersEnabled,
    },
  ];

  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.field} className="flex items-center justify-between gap-4 py-4">
          <div className="min-w-0">
            <p className="font-medium">{r.label}</p>
            <p className="truncate text-sm text-muted-foreground">{r.description}</p>
          </div>
          <Toggle defaultOn={r.on} label={r.label} onChange={(on) => setFlag(r.field, on)} />
        </li>
      ))}
    </ul>
  );
}

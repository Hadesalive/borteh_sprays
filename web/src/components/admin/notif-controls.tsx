"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { updateNotifPref } from "@/app/(dashboard)/settings/notifications/actions";
import { Toggle } from "@/components/admin/toggle";

type NotifField = "in_app_enabled" | "push_enabled" | "marketing_opt_in";

const ROWS: Array<{ field: NotifField; label: string; description: string }> = [
  { field: "in_app_enabled", label: "In-app alerts", description: "Show order and activity alerts inside the admin." },
  { field: "push_enabled", label: "Push notifications", description: "Send alerts to your device, even when the app is closed." },
  { field: "marketing_opt_in", label: "Marketing updates", description: "Occasional product news and tips from Borteh." },
];

export function NotifControls({
  inApp,
  push,
  marketing,
}: {
  userId: string;
  inApp: boolean;
  push: boolean;
  marketing: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();

  const values: Record<NotifField, boolean> = {
    in_app_enabled: inApp,
    push_enabled: push,
    marketing_opt_in: marketing,
  };

  return (
    <ul className="mx-auto max-w-3xl divide-y divide-border px-6 py-2 lg:px-10">
      {ROWS.map((row) => (
        <li key={row.field} className="flex items-center justify-between gap-4 py-4">
          <div className="min-w-0">
            <p className="font-medium">{row.label}</p>
            <p className="truncate text-sm text-muted-foreground">{row.description}</p>
          </div>
          <Toggle
            defaultOn={values[row.field]}
            label={row.label}
            onChange={(on) =>
              start(async () => {
                const res = await updateNotifPref(row.field, on);
                if (res.ok) router.refresh();
                else alert(res.error);
              })
            }
          />
        </li>
      ))}
    </ul>
  );
}

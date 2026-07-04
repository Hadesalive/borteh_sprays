"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setCustomerBlocked } from "@/app/(dashboard)/customers/actions";
import { cn } from "@/lib/utils";

export function CustomerActions({ id, blocked, name }: { id: string; blocked: boolean; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle() {
    const next = !blocked;
    if (next && !confirm(`Block ${name}? They won't be able to place orders.`)) return;
    start(async () => {
      const res = await setCustomerBlocked(id, next);
      if (res.ok) router.refresh();
      else alert(res.error);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={cn(
        "inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors disabled:opacity-60",
        blocked
          ? "border-border text-primary hover:bg-muted"
          : "border-border text-muted-foreground hover:bg-muted hover:text-destructive"
      )}
    >
      {pending ? "…" : blocked ? "Unblock" : "Block"}
    </button>
  );
}

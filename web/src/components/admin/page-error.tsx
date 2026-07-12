"use client";

import { WarningCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

/**
 * The error state every route segment shows. Addressed to the shop owner:
 * no stack traces, no file paths, no vendor names.
 */
export function PageError({
  title = "Couldn't load this page",
  reset,
}: {
  title?: string;
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-5 text-center">
      <WarningCircle weight="duotone" className="size-8 text-muted-foreground" />
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-sm text-[13px] text-muted-foreground">
        Check your internet connection and try again. If it keeps happening,
        the shop&apos;s data service may be down for a moment.
      </p>
      <Button onClick={reset} className="mt-1">
        Try again
      </Button>
    </div>
  );
}

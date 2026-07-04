"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Toggle({
  defaultOn = false,
  label,
  onChange,
}: {
  defaultOn?: boolean;
  label?: string;
  onChange?: (on: boolean) => void;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => {
        const next = !on;
        setOn(next);
        onChange?.(next);
      }}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        on ? "bg-primary" : "bg-input"
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-background shadow-sm transition-transform",
          on ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

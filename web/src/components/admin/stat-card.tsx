import Link from "next/link";

import { cn } from "@/lib/utils";
import { formatPct } from "@/lib/format";
import { Card } from "@/components/ui/card";

function Delta({ ratio, caption }: { ratio: number; caption: string }) {
  const up = ratio > 0;
  return (
    <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
      <span className={cn("nums text-xs font-medium", up ? "text-success" : "text-destructive")}>
        {up ? "▲" : "▼"} {formatPct(Math.abs(ratio), 1)}
      </span>
      <span>{caption}</span>
    </p>
  );
}

/**
 * One big number, its label, and an optional trend delta — the hero-metric
 * pattern used once per page (Dashboard's revenue number), never as a wall
 * of co-equal tiles (see docs/superpowers/specs/2026-09-02-admin-redesign-design.md).
 */
export function StatCard({
  label,
  value,
  delta,
  href,
}: {
  label: string;
  value: string;
  delta?: { ratio: number; caption: string };
  href?: string;
}) {
  const body = (
    <Card className="p-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="nums mt-1 text-[2.75rem] leading-none font-semibold tracking-[-0.02em]">{value}</p>
      {delta ? <Delta ratio={delta.ratio} caption={delta.caption} /> : null}
    </Card>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

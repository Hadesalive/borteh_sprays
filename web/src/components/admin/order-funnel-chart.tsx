"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";

import { formatInt, formatPct } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const RING_COLORS = ["var(--chart-1)", "var(--chart-3)", "var(--success)"];

const chartConfig = {
  count: { label: "Orders" },
} satisfies ChartConfig;

/** Placed / Confirmed / Delivered as concentric rings (shadcn's radial-bar
 *  family, activity-ring style): the outer ring is the first stage at 100%,
 *  each inner ring is the share that made it to the next stage, so the
 *  funnel narrows toward the center. Every ring keeps a muted track behind
 *  it so a zero stage still shows as an empty ring rather than vanishing;
 *  the legend beside the rings carries the exact counts. */
export function OrderFunnelChart({ stages }: { stages: { stage: string; count: number }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  const colored = stages.map((s, i) => ({ ...s, fill: RING_COLORS[i % RING_COLORS.length] }));
  // Recharts draws the first row innermost, so reverse: last stage in the
  // center, first stage outermost.
  const rings = [...colored].reverse();

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
      <ChartContainer config={chartConfig} className="aspect-square h-44 shrink-0" role="img" aria-label="Order funnel, last 7 days">
        <RadialBarChart data={rings} startAngle={90} endAngle={-270} innerRadius={30} outerRadius={84} barSize={12}>
          <PolarAngleAxis type="number" domain={[0, max]} tick={false} axisLine={false} />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                nameKey="stage"
                formatter={(value, name) => (
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="text-muted-foreground">{name}</span>
                    <span className="nums font-medium">{formatInt(Number(value))}</span>
                  </span>
                )}
              />
            }
          />
          <RadialBar dataKey="count" background={{ fill: "var(--muted)" }} cornerRadius={6} className="stroke-transparent stroke-2" />
        </RadialBarChart>
      </ChartContainer>
      <ul className="flex w-full flex-col gap-2 text-[13px]">
        {colored.map((s) => (
          <li key={s.stage} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: s.fill }} />
              {s.stage}
            </span>
            <span className="nums">
              <span className="font-medium text-foreground">{formatInt(s.count)}</span>{" "}
              <span className="text-muted-foreground">{formatPct(s.count / max)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

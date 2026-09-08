"use client";

import { Funnel, FunnelChart, LabelList } from "recharts";

import { formatInt } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

// ChartContainer requires a config, but Funnel colors each trapezoid via a
// per-datum `fill` below (Recharts' own convention for this component) --
// this entry isn't wired to any `--color-value` usage. Changing its `color`
// here does nothing; edit the `fill` values in `data` below instead.
const chartConfig = {
  value: { label: "Orders", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Real tapering funnel (Recharts' trapezoid shapes) for the Placed /
 *  Confirmed / Delivered stage counts. A horizontal BarChart was used here
 *  originally as a defensive choice made with no way to visually verify a
 *  render in this pipeline; replaced now that the live page can be checked
 *  directly. Per-stage counts stay in the DOM as plain text below the chart
 *  (page.tsx's drop-off row), not only in this chart's hover tooltip — a
 *  real keyboard/screen-reader concern for funnel data. The last stage
 *  renders in the success color so "made it all the way through" reads at
 *  a glance. */
export function OrderFunnelChart({ stages }: { stages: { stage: string; count: number }[] }) {
  const data = stages.map((s, i) => ({
    name: s.stage,
    value: s.count,
    fill: i === stages.length - 1 ? "var(--success)" : "var(--chart-1)",
  }));

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-40 w-full" role="img" aria-label="Order funnel, last 7 days">
      <FunnelChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" formatter={(value) => formatInt(Number(value))} />} />
        <Funnel data={data} dataKey="value" nameKey="name">
          <LabelList position="right" dataKey="name" fill="var(--muted-foreground)" stroke="none" fontSize={12} />
        </Funnel>
      </FunnelChart>
    </ChartContainer>
  );
}

"use client";

import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";

import { formatInt } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  count: { label: "Orders", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Placed / Confirmed / Delivered as labeled horizontal bars — shadcn's
 *  "Bar Chart – Custom Label" pattern, which is how its gallery presents
 *  step/funnel data (it ships no trapezoid funnel; Recharts' own Funnel
 *  renders a wide flat wedge at three stages in a landscape card). Stage
 *  names sit on the axis so they stay visible even when a stage is zero,
 *  counts sit at the end of each bar, and the last stage is the success
 *  color so "made it all the way through" reads at a glance. */
export function OrderFunnelChart({ stages }: { stages: { stage: string; count: number }[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-36 w-full" role="img" aria-label="Order funnel, last 7 days">
      <BarChart accessibilityLayer data={stages} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }}>
        <YAxis dataKey="stage" type="category" tickLine={false} tickMargin={10} axisLine={false} width={80} stroke="var(--muted-foreground)" />
        <XAxis type="number" hide />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" formatter={(value) => formatInt(Number(value))} />} />
        <Bar dataKey="count" radius={4} maxBarSize={24}>
          {stages.map((s, i) => (
            <Cell key={s.stage} fill={i === stages.length - 1 ? "var(--success)" : "var(--color-count)"} />
          ))}
          <LabelList dataKey="count" position="right" offset={8} className="fill-foreground" fontSize={12} formatter={(value) => formatInt(Number(value))} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

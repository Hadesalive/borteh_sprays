"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { formatInt } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  count: { label: "Orders", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Horizontal bar funnel — Placed / Confirmed / Delivered, oldest stage on
 *  top. The last stage renders in the success color so "made it all the way
 *  through" reads at a glance. Recharts' literal Funnel/trapezoid shape was
 *  considered and skipped: nothing in this codebase's build/review pipeline
 *  can render a browser, so a chart's correctness can only ever be verified
 *  by reading source and running tsc/tests — a horizontal BarChart is a
 *  pattern this exact codebase has already proven correct (RevenueChart, an
 *  identical BarChart usage, has been live since Wave 0), and reads as a
 *  valid funnel visualization on its own terms. */
export function OrderFunnelChart({ stages }: { stages: { stage: string; count: number }[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-32 w-full" role="img" aria-label="Order funnel, last 7 days">
      <BarChart data={stages} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="stage" tickLine={false} axisLine={false} width={76} stroke="var(--muted-foreground)" className="text-muted-foreground" />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatInt(Number(value))} />} />
        <Bar dataKey="count" radius={0}>
          {stages.map((s, i) => (
            <Cell key={s.stage} fill={i === stages.length - 1 ? "var(--success)" : "var(--color-count)"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

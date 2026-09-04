"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { formatLe } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

/** Bar + trend-line revenue chart. Bars are daily revenue; the line traces
 *  the same series so the trend reads at a glance without a second metric. */
export function RevenueChart({ data, labels }: { data: number[]; labels: string[] }) {
  const rows = data.map((revenue, i) => ({ day: labels[i], revenue }));

  return (
    <ChartContainer config={chartConfig} className="mt-3 aspect-auto h-44 w-full" role="img" aria-label="Revenue, last 7 days">
      <BarChart data={rows} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          stroke="var(--muted-foreground)"
          className="text-muted-foreground"
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatLe(Number(value))} />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={0} />
      </BarChart>
    </ChartContainer>
  );
}

/** A second, line-only rendering of the same series — used where a trend
 *  needs to sit inline without the bars (kept separate rather than
 *  overloading RevenueChart with a `variant` prop no current caller needs). */
export function RevenueTrendLine({ data, labels }: { data: number[]; labels: string[] }) {
  const rows = data.map((revenue, i) => ({ day: labels[i], revenue }));

  return (
    <ChartContainer config={chartConfig} className="h-16 w-full">
      <LineChart data={rows} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
        <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}

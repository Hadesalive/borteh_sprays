"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { formatLe } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  revenue: { label: "This week", color: "var(--chart-1)" },
  previous: { label: "Last week", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** Daily revenue as a gradient-filled area (shadcn's "Area Chart – Gradient"),
 *  with the previous week traced as a dashed line behind it when the caller
 *  supplies one — so the trend and the week-over-week comparison read from
 *  the same picture. */
export function RevenueChart({ data, labels, previous }: { data: number[]; labels: string[]; previous?: number[] }) {
  const rows = data.map((revenue, i) => ({ day: labels[i], revenue, previous: previous?.[i] }));
  const gradientId = `revenue-fill-${useId().replace(/:/g, "")}`;

  return (
    <ChartContainer config={chartConfig} className="mt-3 aspect-auto h-52 w-full" role="img" aria-label="Revenue, last 7 days">
      <AreaChart accessibilityLayer data={rows} margin={{ left: 12, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} stroke="var(--muted-foreground)" />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label ?? name}</span>
                  <span className="nums font-medium">{formatLe(Number(value))}</span>
                </span>
              )}
            />
          }
        />
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        {previous ? (
          <Area dataKey="previous" type="natural" fill="transparent" stroke="var(--color-previous)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 3 }} />
        ) : null}
        <Area dataKey="revenue" type="natural" fill={`url(#${gradientId})`} fillOpacity={0.4} stroke="var(--color-revenue)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
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

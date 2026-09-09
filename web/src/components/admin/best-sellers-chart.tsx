"use client";

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";

import { formatLe } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

// Ordered for contrast between neighbours (the gray sits last so it never
// lands beside the bronze).
const BAR_COLORS = ["var(--chart-1)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-2)"];

const chartConfig = {
  revenue: { label: "Revenue" },
} satisfies ChartConfig;

const truncate = (name: string) => (name.length > 18 ? `${name.slice(0, 17)}…` : name);

/** Top products by revenue as ranked horizontal bars, one color per product
 *  — shadcn's "Bar Chart – Mixed" — with the value at the end of each bar.
 *  Bar height is capped so a one-product week reads as one slim bar, not a
 *  solid block. The caller decides the window (7-day, or an all-time
 *  fallback when the week was quiet); this only renders the list it's given. */
export function BestSellersChart({ items }: { items: { name: string; minor: number }[] }) {
  const rows = items.map((it, i) => ({ name: it.name, revenue: it.minor, fill: BAR_COLORS[i % BAR_COLORS.length] }));

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full" role="img" aria-label="Best sellers by revenue">
      <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 0, right: 56, top: 0, bottom: 0 }}>
        <YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} width={120} stroke="var(--muted-foreground)" tickFormatter={truncate} />
        <XAxis type="number" hide />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="name" formatter={(value, name) => (
          <span className="flex w-full items-center justify-between gap-3">
            <span className="text-muted-foreground">{name}</span>
            <span className="nums font-medium">{formatLe(Number(value))}</span>
          </span>
        )} />} />
        <Bar dataKey="revenue" radius={4} maxBarSize={24}>
          <LabelList dataKey="revenue" position="right" offset={8} className="fill-foreground" fontSize={12} formatter={(value) => formatLe(Number(value))} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

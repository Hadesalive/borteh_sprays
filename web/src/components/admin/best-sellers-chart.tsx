"use client";

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";

import { formatLe } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig;

const truncate = (name: string) => (name.length > 18 ? `${name.slice(0, 17)}…` : name);

/** Top products by revenue as ranked horizontal bars — shadcn's "Bar Chart –
 *  Horizontal" pattern with the value at the end of each bar. Bar height is
 *  capped so a one-product week reads as one slim bar, not a solid block.
 *  The caller decides the window (7-day, or an all-time fallback when the
 *  week was quiet); this only renders whatever list it's given. */
export function BestSellersChart({ items }: { items: { name: string; minor: number }[] }) {
  const rows = items.map((it) => ({ name: it.name, revenue: it.minor }));

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full" role="img" aria-label="Best sellers by revenue">
      <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 0, right: 56, top: 0, bottom: 0 }}>
        <YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} width={120} stroke="var(--muted-foreground)" tickFormatter={truncate} />
        <XAxis type="number" hide />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" formatter={(value) => formatLe(Number(value))} />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} maxBarSize={24}>
          <LabelList dataKey="revenue" position="right" offset={8} className="fill-foreground" fontSize={12} formatter={(value) => formatLe(Number(value))} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

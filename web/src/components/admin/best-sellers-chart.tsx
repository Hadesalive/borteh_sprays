"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { formatLe } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Top products by revenue — the caller decides the window (7-day, or an
 *  all-time fallback when the week was quiet); this only renders whatever
 *  list it's given. */
export function BestSellersChart({ items }: { items: { name: string; minor: number }[] }) {
  const rows = items.map((it) => ({ name: it.name, revenue: it.minor }));

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full" role="img" aria-label="Best sellers by revenue">
      <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={128} stroke="var(--muted-foreground)" className="text-muted-foreground" tick={{ fontSize: 12 }} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatLe(Number(value))} />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={0} />
      </BarChart>
    </ChartContainer>
  );
}

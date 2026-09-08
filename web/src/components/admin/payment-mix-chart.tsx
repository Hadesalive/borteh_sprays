"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";

import { formatLe } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  cod: { label: "Cash & COD", color: "var(--chart-1)" },
  prepaid: { label: "Prepaid", color: "var(--chart-3)" },
} satisfies ChartConfig;

/** Single 100%-stacked bar splitting revenue between cash-on-delivery and
 *  prepaid orders. A donut/pie forces an angle judgment to compare two
 *  slices -- the least accurate way people compare quantities; a stacked
 *  bar uses length instead, and its two segments sit directly beside the
 *  exact-amount rows already rendered under this chart (page.tsx), so
 *  reading it never depends on matching a color back to a legend. */
export function PaymentMixChart({ codMinor, prepaidMinor }: { codMinor: number; prepaidMinor: number }) {
  const data = [{ name: "mix", cod: codMinor, prepaid: prepaidMinor }];

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-9 w-full" role="img" aria-label="Payment mix, cash on delivery versus prepaid">
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" hide />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, name) => (
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label ?? name}</span>
                  <span className="font-medium">{formatLe(Number(value))}</span>
                </span>
              )}
            />
          }
        />
        <Bar dataKey="cod" stackId="mix" fill="var(--color-cod)" radius={0} />
        <Bar dataKey="prepaid" stackId="mix" fill="var(--color-prepaid)" radius={0} />
      </BarChart>
    </ChartContainer>
  );
}

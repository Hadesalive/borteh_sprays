"use client";

import { Cell, Pie, PieChart } from "recharts";

import { formatLe } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  cod: { label: "Cash & COD", color: "var(--chart-1)" },
  prepaid: { label: "Prepaid", color: "var(--chart-3)" },
} satisfies ChartConfig;

/** Donut split of revenue between cash-on-delivery and prepaid orders. */
export function PaymentMixChart({ codMinor, prepaidMinor }: { codMinor: number; prepaidMinor: number }) {
  const data = [
    { key: "cod", value: codMinor },
    { key: "prepaid", value: prepaidMinor },
  ];

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square h-32" role="img" aria-label="Payment mix, cash on delivery versus prepaid">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="key"
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
        <Pie data={data} dataKey="value" nameKey="key" innerRadius={36} outerRadius={56} strokeWidth={0}>
          {data.map((d) => (
            <Cell key={d.key} fill={`var(--color-${d.key})`} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

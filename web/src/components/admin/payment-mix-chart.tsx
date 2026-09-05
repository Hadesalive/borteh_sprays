"use client";

import { Cell, Pie, PieChart } from "recharts";

import { formatLe } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  cod: { label: "Cash & COD", color: "var(--chart-1)" },
  prepaid: { label: "Prepaid", color: "var(--chart-2)" },
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
        <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel formatter={(value) => formatLe(Number(value))} />} />
        <Pie data={data} dataKey="value" nameKey="key" innerRadius={36} outerRadius={56} strokeWidth={0}>
          {data.map((d) => (
            <Cell key={d.key} fill={`var(--color-${d.key})`} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

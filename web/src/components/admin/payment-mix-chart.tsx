"use client";

import { Label, Pie, PieChart } from "recharts";

import { formatLe } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

// Colors are mirrored as `bg-chart-1` / `bg-chart-3` swatches on the
// breakdown rows in analytics/page.tsx — keep the two in sync.
const chartConfig = {
  amount: { label: "Revenue" },
  cod: { label: "Cash & COD", color: "var(--chart-1)" },
  prepaid: { label: "Prepaid", color: "var(--chart-3)" },
} satisfies ChartConfig;

/** Donut split of revenue between cash-on-delivery and prepaid orders,
 *  following shadcn's "Pie Chart – Donut with Text" pattern: the 7-day total
 *  sits in the ring's center, segments are separated by a card-colored gap,
 *  and the exact per-method amounts live in the swatched rows the page
 *  renders directly beneath. */
export function PaymentMixChart({ codMinor, prepaidMinor }: { codMinor: number; prepaidMinor: number }) {
  const data = [
    { method: "cod", amount: codMinor, fill: "var(--color-cod)" },
    { method: "prepaid", amount: prepaidMinor, fill: "var(--color-prepaid)" },
  ];
  const total = codMinor + prepaidMinor;

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-44" role="img" aria-label="Payment mix, cash on delivery versus prepaid">
      <PieChart>
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="method" formatter={(value, name) => (
          <span className="flex w-full items-center justify-between gap-3">
            <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label ?? name}</span>
            <span className="nums font-medium">{formatLe(Number(value))}</span>
          </span>
        )} />} />
        <Pie data={data} dataKey="amount" nameKey="method" innerRadius={52} strokeWidth={4} stroke="var(--card)">
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={viewBox.cx} y={viewBox.cy} className="nums fill-foreground text-xl font-semibold">
                      {formatLe(total)}
                    </tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-xs">
                      7-day revenue
                    </tspan>
                  </text>
                );
              }
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

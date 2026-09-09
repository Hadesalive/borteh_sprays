"use client";

import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";

import { formatLe } from "@/lib/format";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

// Colors are mirrored as `bg-chart-1` / `bg-chart-3` swatches on the
// breakdown rows in analytics/page.tsx — keep the two in sync.
const chartConfig = {
  app: { label: "App orders", color: "var(--chart-1)" },
  till: { label: "Till sales", color: "var(--chart-3)" },
} satisfies ChartConfig;

/** App-order vs till revenue as a stacked half-ring gauge — shadcn's
 *  "Radial Chart – Stacked". The two segments share one arc, so the split
 *  reads as a single proportion; the 7-day total sits in the gauge's mouth,
 *  and the exact per-channel amounts live in the swatched rows the page
 *  renders beneath. */
export function PaymentMixChart({ appMinor, tillMinor }: { appMinor: number; tillMinor: number }) {
  const data = [{ app: appMinor, till: tillMinor }];
  const total = appMinor + tillMinor;

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-[5/3] w-full max-w-60" role="img" aria-label="Revenue by channel, app orders versus till sales">
      <RadialBarChart data={data} startAngle={0} endAngle={180} cy="82%" innerRadius={76} outerRadius={104}>
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, name) => (
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label ?? name}</span>
                  <span className="nums font-medium">{formatLe(Number(value))}</span>
                </span>
              )}
            />
          }
        />
        <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                    <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 14} className="nums fill-foreground text-xl font-semibold">
                      {formatLe(total)}
                    </tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 8} className="fill-muted-foreground text-xs">
                      7-day revenue
                    </tspan>
                  </text>
                );
              }
            }}
          />
        </PolarRadiusAxis>
        <RadialBar dataKey="till" stackId="mix" fill="var(--color-till)" cornerRadius={4} className="stroke-transparent stroke-2" />
        <RadialBar dataKey="app" stackId="mix" fill="var(--color-app)" cornerRadius={4} className="stroke-transparent stroke-2" />
      </RadialBarChart>
    </ChartContainer>
  );
}

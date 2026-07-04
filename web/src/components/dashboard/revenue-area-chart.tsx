import { cn } from "@/lib/utils";
import { formatLe } from "@/lib/format";

export type RevenuePoint = { label: string; minor: number };

/**
 * Dependency-free SVG area chart. Renders a smooth line + soft brand-rose
 * fill. Scales responsively via a fixed viewBox; stroke stays crisp.
 */
export function RevenueAreaChart({
  data,
  className,
}: {
  data: RevenuePoint[];
  className?: string;
}) {
  const W = 760;
  const H = 240;
  const padX = 6;
  const padT = 18;
  const padB = 30;
  const innerW = W - padX * 2;
  const innerH = H - padT - padB;

  const values = data.map((d) => d.minor);
  const max = Math.max(...values);
  const span = max || 1;
  const baseline = padT + innerH;
  const stepX = innerW / Math.max(data.length - 1, 1);

  const pts = data.map((d, i) => ({
    x: padX + i * stepX,
    y: padT + innerH - (d.minor / span) * innerH,
    ...d,
  }));

  // Smooth path via midpoint quadratics (bounded, no overshoot).
  let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const xMid = (pts[i - 1].x + pts[i].x) / 2;
    const yMid = (pts[i - 1].y + pts[i].y) / 2;
    line += ` Q ${pts[i - 1].x.toFixed(1)} ${pts[i - 1].y.toFixed(1)} ${xMid.toFixed(1)} ${yMid.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  line += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  const area = `${line} L ${last.x.toFixed(1)} ${baseline} L ${pts[0].x.toFixed(1)} ${baseline} Z`;

  const gridRatios = [0, 0.5, 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("h-auto w-full text-chart-1", className)}
      role="img"
      aria-label={`Revenue trend: peak ${formatLe(max)} on ${
        data[values.indexOf(max)]?.label ?? ""
      }`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.20" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridRatios.map((r) => {
        const y = padT + innerH - r * innerH;
        return (
          <line
            key={r}
            x1={padX}
            x2={W - padX}
            y1={y}
            y2={y}
            stroke="var(--color-border)"
            strokeWidth={1}
            strokeDasharray={r === 0 ? undefined : "3 5"}
          />
        );
      })}

      <path d={area} fill="url(#revenue-fill)" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      <circle cx={last.x} cy={last.y} r={4} fill="currentColor" />
      <circle
        cx={last.x}
        cy={last.y}
        r={7}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={2}
      />

      {pts.map((p) => (
        <text
          key={p.label}
          x={p.x}
          y={H - 10}
          textAnchor="middle"
          className="fill-muted-foreground text-[11px]"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}

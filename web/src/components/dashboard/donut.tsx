import { cn } from "@/lib/utils";

export type DonutSegment = { label: string; value: number; color: string };

/**
 * Dependency-free SVG donut. `color` is any CSS color (pass a token var like
 * "var(--color-chart-1)"). Children render centered inside the ring.
 */
export function Donut({
  segments,
  size = 140,
  thickness = 16,
  className,
  children,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const gap = 2; // px gap between segments

  let offset = 0;
  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-cream)"
          strokeWidth={thickness}
        />
        {segments.map((s) => {
          const len = (s.value / total) * circumference;
          const seg = Math.max(len - gap, 0);
          const node = (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${seg} ${circumference - seg}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
            />
          );
          offset += len;
          return node;
        })}
      </svg>
      {children ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
          {children}
        </div>
      ) : null}
    </div>
  );
}

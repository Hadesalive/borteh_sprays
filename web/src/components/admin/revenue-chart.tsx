import { formatInt, formatLe } from "@/lib/format";

// Bar + trend-line revenue chart (Borteh Admin v5). Bars = daily revenue, bronze
// line traces the trend, end label calls out the latest day.
export function RevenueChart({ data, labels }: { data: number[]; labels: string[] }) {
  const W = 720, H = 185, baseline = 160, top = 25, plot = baseline - top;
  const max = Math.max(...data, 1);
  const step = 100, bw = 34, x0 = 20;
  const cx = (i: number) => x0 + i * step + bw / 2;
  const barY = (v: number) => baseline - (v / max) * plot;
  const half = max / 2;
  const gy1 = baseline - (half / max) * plot;
  const points = data.map((v, i) => `${cx(i)},${barY(v).toFixed(1)}`).join(" ");
  const last = data.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block h-44 w-full" role="img" aria-label="Revenue, last 7 days">
      <line x1="0" x2={W} y1={baseline} y2={baseline} stroke="var(--border)" strokeWidth="1" />
      <line x1="0" x2={W} y1={gy1.toFixed(1)} y2={gy1.toFixed(1)} stroke="var(--accent)" strokeWidth="1" />
      <line x1="0" x2={W} y1={top + 10} y2={top + 10} stroke="var(--accent)" strokeWidth="1" />
      <text x="0" y={gy1 - 4} className="fill-[#B5B2AC] text-[11px]">{formatLe(half)}</text>
      <text x="0" y={top + 6} className="fill-[#B5B2AC] text-[11px]">{formatLe(max)}</text>
      {data.map((v, i) => (
        <rect key={i} x={x0 + i * step} y={barY(v)} width={bw} height={Math.max(baseline - barY(v), 0)} rx="2" fill="var(--accent)" />
      ))}
      <polyline points={points} fill="none" stroke="var(--brand)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={cx(last)} cy={barY(data[last])} r="2.5" fill="var(--brand)" />
      <text x={cx(last) + 11} y={barY(data[last]) - 3} className="fill-[--brand] text-[11px] font-semibold">{formatInt(data[last])}</text>
      {labels.map((l, i) => (
        <text key={l + i} x={cx(i)} y="178" textAnchor="middle" className="fill-[#B5B2AC] text-[11px]">{l}</text>
      ))}
    </svg>
  );
}

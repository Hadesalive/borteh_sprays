import Link from "next/link";
import { ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr";

import { formatInt } from "@/lib/format";

export type EngagementRow = { event_type: string; events: number; users: number };
export type SimilarProduct = { id: string; name: string; brand: string };

const METRICS: { key: string; label: string }[] = [
  { key: "view", label: "Views" },
  { key: "dwell", label: "Dwell" },
  { key: "add_to_bag", label: "Add to bag" },
  { key: "wishlist_add", label: "Wishlist" },
  { key: "purchase", label: "Purchases" },
  { key: "not_interested", label: "Not for me" },
];

export function ProductSignals({
  engagement,
  similar,
  available,
}: {
  engagement: EngagementRow[];
  similar: SimilarProduct[];
  available: boolean;
}) {
  const byType = new Map(engagement.map((e) => [e.event_type, e]));
  const totalEvents = engagement.reduce((s, e) => s + e.events, 0);

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_1px_0_rgba(26,26,26,0.07)]">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-[13px] font-[650] tracking-[-0.1px]">Engagement</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">How customers interact with this scent in the app. Read-only signal from the recs pipeline.</p>
      </div>

      <div className="px-5 py-4">
        {!available ? (
          <p className="text-[13px] text-muted-foreground">Engagement is unavailable — set <code className="nums text-[12px]">SUPABASE_SECRET_KEY</code> in <span className="nums">web/.env.local</span> to read the recs pipeline.</p>
        ) : totalEvents === 0 ? (
          <p className="text-[13px] text-muted-foreground">No interactions logged yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {METRICS.map((m) => {
              const row = byType.get(m.key);
              return (
                <div key={m.key}>
                  <div className="nums text-lg font-[650] leading-none">{formatInt(row?.events ?? 0)}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{m.label}</div>
                  {row && row.users > 0 ? <div className="nums text-[11px] text-[#B5B2AC]">{formatInt(row.users)} people</div> : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-border px-5 py-3">
        <h3 className="flex items-center gap-1.5 text-[13px] font-[650] tracking-[-0.1px]">
          <Sparkle weight="duotone" className="size-4 text-brand" />
          Customers also see as similar
        </h3>
      </div>
      <div className="px-5 pb-4">
        {similar.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No similar scents yet — this product may still be embedding, or needs a scent family + notes.</p>
        ) : (
          <ul className="space-y-1">
            {similar.map((s, i) => (
              <li key={s.id}>
                <Link href={`/products/${s.id}`} className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-muted">
                  <span className="min-w-0 truncate">
                    <span className="nums mr-2 text-[11px] text-[#B5B2AC]">{i + 1}</span>
                    <span className="font-medium">{s.name}</span> <span className="text-muted-foreground">{s.brand}</span>
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

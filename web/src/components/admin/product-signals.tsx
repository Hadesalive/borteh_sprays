import Link from "next/link";
import { ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
    <Card className="overflow-hidden p-0">
      <CardHeader className="border-b pt-4">
        <CardTitle>Engagement</CardTitle>
        <CardDescription>How customers interact with this scent in the app. Read-only signal from the recs pipeline.</CardDescription>
      </CardHeader>

      <CardContent className="py-4">
        {!available ? (
          <p className="text-[13px] text-muted-foreground">Engagement data isn&rsquo;t available right now.</p>
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
                  {row && row.users > 0 ? <div className="nums text-[11px] text-muted-foreground">{formatInt(row.users)} people</div> : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <CardHeader className="border-t pt-4 pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Sparkle weight="duotone" className="size-4 text-brand" />
          Customers also see as similar
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {similar.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No similar scents yet — this product may still be embedding, or needs a scent family + notes.</p>
        ) : (
          <ul className="space-y-1">
            {similar.map((s, i) => (
              <li key={s.id}>
                <Link href={`/products/${s.id}`} className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-muted">
                  <span className="min-w-0 truncate">
                    <span className="nums mr-2 text-[11px] text-muted-foreground">{i + 1}</span>
                    <span className="font-medium">{s.name}</span> <span className="text-muted-foreground">{s.brand}</span>
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

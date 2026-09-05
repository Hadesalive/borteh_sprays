import { BellRinging } from "@phosphor-icons/react/dist/ssr";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { formatInt } from "@/lib/format";

export type RestockGroup = { variantId: string; label: string; sku: string; count: number };

export function ProductRestock({ groups }: { groups: RestockGroup[] }) {
  const total = groups.reduce((s, g) => s + g.count, 0);

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="border-b pt-4">
        <CardTitle className="flex items-center gap-1.5">
          <BellRinging weight="duotone" className="size-4 text-brand" />
          Restock waitlist
        </CardTitle>
        <CardDescription>Receiving stock into an out-of-stock variant notifies these customers automatically.</CardDescription>
        <CardAction>
          <span className="nums text-lg font-[650]">{formatInt(total)}</span>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {total === 0 ? (
          <p className="px-5 py-6 text-center text-[13px] text-muted-foreground">No one is waiting on a restock.</p>
        ) : (
          <ul>
            {groups.filter((g) => g.count > 0).map((g) => (
              <li key={g.variantId} className="flex items-center justify-between gap-2 border-t border-border px-5 py-2.5 first:border-t-0">
                <span className="min-w-0">
                  <span className="text-[13px] font-medium">{g.label}</span>
                  <span className="nums ml-2 text-[12px] text-muted-foreground">{g.sku}</span>
                </span>
                <span className="nums text-[13px]">{formatInt(g.count)} waiting</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

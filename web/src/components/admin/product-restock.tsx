import { BellRinging } from "@phosphor-icons/react/dist/ssr";

import { formatInt } from "@/lib/format";

export type RestockGroup = { variantId: string; label: string; sku: string; count: number };

export function ProductRestock({ groups }: { groups: RestockGroup[] }) {
  const total = groups.reduce((s, g) => s + g.count, 0);

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_1px_0_rgba(26,26,26,0.07)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-[13px] font-[650] tracking-[-0.1px]">
            <BellRinging weight="duotone" className="size-4 text-brand" />
            Restock waitlist
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Receiving stock into an out-of-stock variant notifies these customers automatically.</p>
        </div>
        <span className="nums text-lg font-[650]">{formatInt(total)}</span>
      </div>
      {total === 0 ? (
        <p className="px-5 py-6 text-center text-[13px] text-muted-foreground">No one is waiting on a restock.</p>
      ) : (
        <ul>
          {groups.filter((g) => g.count > 0).map((g) => (
            <li key={g.variantId} className="flex items-center justify-between gap-2 border-t border-border px-5 py-2.5 first:border-t-0">
              <span className="min-w-0">
                <span className="text-[13px] font-medium">{g.label}</span>
                <span className="nums ml-2 text-[12px] text-[#B5B2AC]">{g.sku}</span>
              </span>
              <span className="nums text-[13px]">{formatInt(g.count)} waiting</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

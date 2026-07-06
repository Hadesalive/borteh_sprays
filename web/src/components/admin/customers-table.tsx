"use client";

import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { formatInt, formatLe } from "@/lib/format";
import { Chip, type Tone } from "@/components/admin/chip";

export type CustomerRow = {
  id: string;
  name: string;
  contact: string;
  tierLabel: string;
  tierTone: Tone;
  orders: number;
  spent: number;
  last: string;
};

const th = "px-3 py-1.5 text-left text-xs font-medium text-muted-foreground";
const thR = "px-3 py-1.5 text-right text-xs font-medium text-muted-foreground";

export function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  const router = useRouter();
  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_1px_0_rgba(26,26,26,0.07)]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th className={cn(th, "pl-4")}>Customer</th>
              <th className={th}>Tier</th>
              <th className={thR}>Orders</th>
              <th className={thR}>Total spent</th>
              <th className={cn(thR, "pr-4")}>Last order</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr
                key={c.id}
                onClick={() => router.push(`/customers/${c.id}`)}
                className="cursor-pointer border-t border-accent transition-colors hover:bg-muted"
              >
                <td className="py-1.5 pl-4 pr-3 font-medium">
                  {c.name} <span className="nums font-normal text-[12px] text-[#B5B2AC]">{c.contact}</span>
                </td>
                <td className="px-3 py-1.5"><Chip tone={c.tierTone}>{c.tierLabel}</Chip></td>
                <td className="nums px-3 py-1.5 text-right">{formatInt(c.orders)}</td>
                <td className="nums px-3 py-1.5 text-right font-medium">{formatLe(c.spent, 2)}</td>
                <td className="px-3 py-1.5 pr-4 text-right text-muted-foreground">{c.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

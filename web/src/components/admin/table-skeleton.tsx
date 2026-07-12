import { Skeleton } from "@/components/ui/skeleton";

/** A loading placeholder shaped like the table it replaces — not a spinner. */
export function TableSkeleton({
  rows = 8,
  columns,
}: {
  rows?: number;
  columns: number;
}) {
  return (
    <div data-testid="table-skeleton" className="rounded-card border border-border bg-card">
      <div className="flex h-9 items-center gap-4 border-b border-border px-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex h-9 items-center gap-4 border-t border-accent px-3 first:border-t-0">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/admin/empty-state";

export type DataTableColumn<T> = {
  header: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
};

export type DataTableSummaryStat = { n: string; label: string; tone: string };

export type DataTablePagination = {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
};

const th = "px-3 py-1.5 text-left text-xs font-medium text-muted-foreground";

/**
 * The shared chrome behind every list page: a Card frame, an optional
 * summary strip, an optional search/filter row, a table body built from
 * `columns`, an EmptyState for zero rows, and optional pagination. List
 * pages own their data and column definitions; this owns the frame so
 * every list reads as the same product (see docs/superpowers/specs/
 * 2026-09-02-admin-redesign-design.md, "Shared component layer").
 */
export function DataTable<T>({
  summary,
  search,
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  pagination,
}: {
  summary?: DataTableSummaryStat[];
  search?: React.ReactNode;
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty: string;
  pagination?: DataTablePagination;
}) {
  return (
    <Card className="overflow-hidden p-0">
      {summary ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-border px-4 py-2.5">
          {summary.map((s) => (
            <span key={s.label} className="text-[13px] text-muted-foreground">
              <span className={cn("nums font-[650]", s.tone)}>{s.n}</span> {s.label}
            </span>
          ))}
        </div>
      ) : null}

      {search ? <div className="flex flex-wrap items-center gap-2 px-4 py-3">{search}</div> : null}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border">
              {columns.map((c, i) => (
                <th
                  key={c.header}
                  className={cn(th, i === 0 && "pl-4", i === columns.length - 1 && "pr-4", c.align === "right" && "text-right")}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-t border-accent transition-colors",
                  onRowClick && "cursor-pointer hover:bg-muted",
                )}
              >
                {columns.map((c, i) => (
                  <td
                    key={c.header}
                    className={cn(
                      "py-1.5",
                      i === 0 ? "pl-4 pr-3" : "px-3",
                      i === columns.length - 1 && "pr-4",
                      c.align === "right" && "text-right",
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 ? <EmptyState title={empty} /> : null}
      </div>

      {pagination && pagination.total > pagination.pageSize ? (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground"
        >
          <span className="nums">
            {pagination.page * pagination.pageSize + 1}–
            {Math.min((pagination.page + 1) * pagination.pageSize, pagination.total)} of {pagination.total}
          </span>
          <div className="flex gap-1">
            <a
              href={pagination.hrefFor(Math.max(0, pagination.page - 1))}
              aria-disabled={pagination.page === 0}
              className={cn(
                "inline-flex h-8 items-center rounded-none border border-border px-3 text-[13px] font-medium",
                pagination.page === 0 ? "pointer-events-none opacity-50" : "hover:bg-muted",
              )}
            >
              Previous
            </a>
            <a
              href={pagination.hrefFor(pagination.page + 1)}
              aria-disabled={(pagination.page + 1) * pagination.pageSize >= pagination.total}
              className={cn(
                "inline-flex h-8 items-center rounded-none border border-border px-3 text-[13px] font-medium",
                (pagination.page + 1) * pagination.pageSize >= pagination.total
                  ? "pointer-events-none opacity-50"
                  : "hover:bg-muted",
              )}
            >
              Next
            </a>
          </div>
        </nav>
      ) : null}
    </Card>
  );
}

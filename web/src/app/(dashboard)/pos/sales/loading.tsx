import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/admin/table-skeleton";

export default function PosSalesLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-1.5 h-3 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="px-5 pb-6 pt-2">
        <TableSkeleton columns={6} rows={10} />
      </div>
    </>
  );
}

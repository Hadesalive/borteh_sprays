import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/admin/table-skeleton";

export default function BrandsLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-20" />
          <Skeleton className="mt-1.5 h-3 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="px-5 pb-6 pt-2">
        <Skeleton className="mb-3 h-3 w-72" />
        <TableSkeleton columns={5} rows={8} />
      </div>
    </>
  );
}

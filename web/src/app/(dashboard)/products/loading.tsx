import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/admin/table-skeleton";

export default function ProductsLoading() {
  return (
    <div className="px-5 pb-6 pt-2">
      <div className="flex items-center justify-between py-2 pb-4">
        <div>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-1.5 h-3 w-80" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
      <TableSkeleton columns={6} rows={10} />
    </div>
  );
}

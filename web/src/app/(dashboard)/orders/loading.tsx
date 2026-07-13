import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/admin/table-skeleton";

export default function OrdersLoading() {
  return (
    <div className="px-5 pb-6 pt-2">
      <div className="flex items-center justify-between py-2 pb-4">
        <div>
          <Skeleton className="h-6 w-28" />
          <Skeleton className="mt-1.5 h-3 w-64" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <TableSkeleton columns={8} rows={10} />
    </div>
  );
}

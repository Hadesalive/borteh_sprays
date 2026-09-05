import { Skeleton } from "@/components/ui/skeleton";

export default function ProductDetailLoading() {
  return (
    <div className="px-5 pb-6 pt-2">
      <Skeleton className="h-3.5 w-20" />

      <div className="flex flex-wrap items-center gap-2.5 pb-4 pt-1">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-16" />
      </div>

      <div className="flex gap-4 border-b border-border pb-3">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-14" />
      </div>

      <Skeleton className="mt-4 h-72 w-full rounded-card" />
    </div>
  );
}

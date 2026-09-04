import { Skeleton } from "@/components/ui/skeleton";

export default function OrderDetailLoading() {
  return (
    <div className="px-5 pb-6 pt-2">
      <Skeleton className="h-3.5 w-16" />

      <div className="flex items-start justify-between py-2 pb-6">
        <div>
          <Skeleton className="h-6 w-28" />
          <Skeleton className="mt-2 h-3 w-56" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-card" />
          <Skeleton className="h-36 w-full rounded-card" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-card" />
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-36 w-full rounded-card" />
        </div>
      </div>
    </div>
  );
}

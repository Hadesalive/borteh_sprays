import { Skeleton } from "@/components/ui/skeleton";

export default function PosSaleDetailLoading() {
  return (
    <div className="px-5 pb-6 pt-2">
      <Skeleton className="h-3.5 w-16" />
      <div className="flex items-start justify-between py-2 pb-6">
        <div>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="mt-2 h-3 w-56" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-64 w-full rounded-card" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      </div>
    </div>
  );
}

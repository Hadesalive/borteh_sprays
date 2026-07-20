import { Skeleton } from "@/components/ui/skeleton";

export default function OverviewLoading() {
  return (
    <div className="px-5 pb-6 pt-2">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="mt-4 h-12 w-48" />
      <Skeleton className="mt-2 h-3 w-40" />
      <Skeleton className="mt-6 h-48 w-full rounded-card" />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56 rounded-card" />
        <Skeleton className="h-56 rounded-card" />
      </div>
    </div>
  );
}

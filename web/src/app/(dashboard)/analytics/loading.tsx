import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-1.5 h-3 w-64" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="px-5 pb-6 pt-2">
        <Skeleton className="h-24 w-full" />
        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
        <Skeleton className="mt-4 h-48 w-full" />
      </div>
    </>
  );
}

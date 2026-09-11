import { Skeleton } from "@/components/ui/skeleton";

export default function ZonesLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-1.5 h-3 w-72" />
        </div>
      </div>
      <div className="px-5 pb-6 pt-6">
        <Skeleton className="h-96 w-full rounded-card" />
      </div>
    </>
  );
}

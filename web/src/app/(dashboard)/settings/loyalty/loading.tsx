import { Skeleton } from "@/components/ui/skeleton";

export default function LoyaltyLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-1.5 h-3 w-80" />
        </div>
      </div>
      <div className="space-y-4 px-5 pb-6 pt-6">
        <Skeleton className="h-28 w-full rounded-card" />
        <Skeleton className="h-72 w-full rounded-card" />
        <Skeleton className="h-44 w-full rounded-card" />
        <Skeleton className="h-56 w-full rounded-card" />
      </div>
    </>
  );
}

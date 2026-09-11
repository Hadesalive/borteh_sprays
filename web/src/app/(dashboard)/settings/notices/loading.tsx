import { Skeleton } from "@/components/ui/skeleton";

export default function NoticesLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-1.5 h-3 w-72" />
        </div>
      </div>
      <div className="px-5 pb-6 pt-2">
        <Skeleton className="mt-2 h-3 w-16" />
        <Skeleton className="mt-4 h-80 w-full rounded-card" />
      </div>
    </>
  );
}

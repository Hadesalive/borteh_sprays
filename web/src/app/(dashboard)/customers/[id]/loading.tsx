import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerDetailLoading() {
  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Skeleton className="h-3.5 w-20" />
        <div className="mt-3 flex items-center gap-3">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-1.5 h-3 w-56" />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-10 gap-y-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
      <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.5fr_1fr] lg:px-10">
        <Skeleton className="h-96 w-full" />
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </>
  );
}

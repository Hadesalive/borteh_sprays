import { Skeleton } from "@/components/ui/skeleton";

export default function PosLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-1.5 h-3 w-64" />
        </div>
      </div>
      <div className="grid gap-0 lg:grid-cols-[1fr_22rem]">
        <div className="border-b border-border px-6 py-5 lg:border-r lg:border-b-0 lg:px-10">
          <Skeleton className="mb-5 h-10 w-full max-w-md" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="px-6 py-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-40 w-full" />
        </div>
      </div>
    </>
  );
}

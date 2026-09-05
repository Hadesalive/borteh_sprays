import { Skeleton } from "@/components/ui/skeleton";

export default function DispatchLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-20" />
          <Skeleton className="mt-1.5 h-3 w-56" />
        </div>
      </div>
      <div className="grid gap-5 px-6 py-6 lg:grid-cols-3 lg:px-10">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </>
  );
}

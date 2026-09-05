import { Skeleton } from "@/components/ui/skeleton";

export default function NewBrandLoading() {
  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Skeleton className="h-3.5 w-16" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="mx-auto max-w-2xl space-y-6 px-6 py-8 lg:px-10">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </>
  );
}

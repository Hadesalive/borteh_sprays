import { Skeleton } from "@/components/ui/skeleton";

export default function NewProductLoading() {
  return (
    <div className="px-5 pb-6 pt-2">
      <Skeleton className="h-3.5 w-20" />
      <div className="pb-4 pt-1">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-2 h-3 w-96" />
      </div>
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-48 w-full rounded-card" />
        <Skeleton className="h-32 w-full rounded-card" />
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function OnboardingLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Skeleton className="h-6 w-28" />
          <Skeleton className="mt-1.5 h-3 w-80" />
        </div>
      </div>
      <div className="mx-auto max-w-2xl space-y-3 px-6 py-8 lg:px-10">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </>
  );
}

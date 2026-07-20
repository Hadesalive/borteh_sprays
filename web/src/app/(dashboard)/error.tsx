"use client";

import { PageError } from "@/components/admin/page-error";

export default function OverviewError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load your overview" reset={reset} />;
}

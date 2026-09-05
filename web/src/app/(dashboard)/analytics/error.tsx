"use client";

import { PageError } from "@/components/admin/page-error";

export default function AnalyticsError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load analytics" reset={reset} />;
}

"use client";

import { PageError } from "@/components/admin/page-error";

export default function DispatchError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load dispatch" reset={reset} />;
}

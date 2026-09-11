"use client";

import { PageError } from "@/components/admin/page-error";

export default function StoreError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load store profile" reset={reset} />;
}

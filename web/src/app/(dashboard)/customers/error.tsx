"use client";

import { PageError } from "@/components/admin/page-error";

export default function CustomersError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load customers" reset={reset} />;
}

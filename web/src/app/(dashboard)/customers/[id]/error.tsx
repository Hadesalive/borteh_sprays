"use client";

import { PageError } from "@/components/admin/page-error";

export default function CustomerDetailError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load this customer" reset={reset} />;
}

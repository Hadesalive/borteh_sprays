"use client";

import { PageError } from "@/components/admin/page-error";

export default function OrderDetailError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load this order" reset={reset} />;
}

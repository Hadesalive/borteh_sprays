"use client";

import { PageError } from "@/components/admin/page-error";

export default function OrdersError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load orders" reset={reset} />;
}

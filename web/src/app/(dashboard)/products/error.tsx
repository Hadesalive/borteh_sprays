"use client";

import { PageError } from "@/components/admin/page-error";

export default function ProductsError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load products" reset={reset} />;
}

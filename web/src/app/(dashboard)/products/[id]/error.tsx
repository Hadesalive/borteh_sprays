"use client";

import { PageError } from "@/components/admin/page-error";

export default function ProductDetailError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load this product" reset={reset} />;
}

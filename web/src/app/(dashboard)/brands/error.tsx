"use client";

import { PageError } from "@/components/admin/page-error";

export default function BrandsError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load brands" reset={reset} />;
}

"use client";

import { PageError } from "@/components/admin/page-error";

export default function BrandFormError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load this brand" reset={reset} />;
}

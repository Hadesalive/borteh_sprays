"use client";

import { PageError } from "@/components/admin/page-error";

export default function CollectionFormError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load this collection" reset={reset} />;
}

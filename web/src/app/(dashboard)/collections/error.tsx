"use client";

import { PageError } from "@/components/admin/page-error";

export default function CollectionsError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load collections" reset={reset} />;
}
